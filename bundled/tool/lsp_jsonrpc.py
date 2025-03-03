# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
"""Light-weight JSON-RPC over standard IO."""


import atexit
import contextlib
import io
import json
import pathlib
import subprocess
import threading
import uuid
import sys
from concurrent.futures import ThreadPoolExecutor
from typing import BinaryIO, Dict, Optional, Sequence, Union

# Configure debug logging
DEBUG = True  # Set to True for verbose logging during development 

def log_debug(message):
    """Debug logger that writes to both stdout and stderr for visibility"""
    if DEBUG:
        print(f"[LSP-JSONRPC] {message}", file=sys.stderr)
        # Also flush stderr to ensure immediate visibility
        sys.stderr.flush()

CONTENT_LENGTH = "Content-Length: "  # Keep this for reference
HEADER_CONTENT_LENGTH = "Content-Length: "  # The exact form expected by VSCode
RUNNER_SCRIPT = str(pathlib.Path(__file__).parent / "lsp_runner.py")


def to_str(text) -> str:
    """Convert bytes to string as needed."""
    return text.decode("utf-8") if isinstance(text, bytes) else text


class StreamClosedException(Exception):
    """JSON RPC stream is closed."""

    pass  # pylint: disable=unnecessary-pass


class JsonWriter:
    """Manages writing JSON-RPC messages to the writer stream."""

    def __init__(self, writer: io.TextIOWrapper):
        # Ensure we have a text mode writer, not binary
        self._writer = writer
        self._lock = threading.Lock()
        # Verify the writer is in text mode, not binary
        if hasattr(self._writer, 'mode') and 'b' in self._writer.mode:
            raise ValueError("JsonWriter requires a text mode writer, not binary")

    def close(self):
        """Closes the underlying writer stream."""
        with self._lock:
            if not self._writer.closed:
                self._writer.close()

    def write(self, data):
        """Writes given data to stream in JSON-RPC format."""
        if self._writer.closed:
            raise StreamClosedException()

        with self._lock:
            try:
                # Validate data is serializable
                if not isinstance(data, (dict, list, str, int, float, bool)) and data is not None:
                    print(f"Warning: Attempting to write non-serializable data: {type(data)}")
                    data = {"jsonrpc": "2.0", "error": {"code": -32603, "message": "Non-serializable data"}}
                
                # If data is a dictionary, ensure it has the jsonrpc field
                if isinstance(data, dict) and "jsonrpc" not in data:
                    data["jsonrpc"] = "2.0"
                
                # Convert data to JSON string
                content = json.dumps(data)
                content_bytes = content.encode("utf-8")
                length = len(content_bytes)
                
                # CRITICAL: VSCode requires EXACTLY this format with CRLF and no deviation
                # Break it down into separate writes to avoid any issues with string concatenation
                self._writer.write("Content-Length: ")
                self._writer.write(str(length))
                self._writer.write("\r\n\r\n")
                self._writer.write(content)
                # Ensure it's all flushed immediately
                self._writer.flush()
                
                # Extra debug info for development
                log_debug(f"Message sent: header=Content-Length: {length}, content={content[:50]}...")
                
                # Log the header for debugging
                log_debug(f"Wrote message with header: Content-Length: {length}")
                
                return True
            except Exception as e:
                # Log the error but don't raise to avoid crashing
                log_debug(f"ERROR writing JSON-RPC message: {e}")
                
                try:
                    # Try to send a minimal error message with proper headers
                    error_msg = {"jsonrpc": "2.0", "error": {"code": -32603, "message": f"Write error: {str(e)[:50]}"}}
                    error_json = json.dumps(error_msg)
                    error_len = len(error_json.encode("utf-8"))
                    
                    # Try to write the error if the stream is still open
                    if not self._writer.closed:
                        # CRITICAL: Write exactly in this format with CRLF
                        # Break it down into separate writes exactly like the normal path
                        self._writer.write("Content-Length: ")
                        self._writer.write(str(error_len))
                        self._writer.write("\r\n\r\n")
                        self._writer.write(error_json)
                        self._writer.flush()
                        log_debug(f"Error response sent with Content-Length: {error_len}")
                except Exception as er:
                    print(f"Error sending error response: {er}")
                    # If even this fails, try one more absolute last resort
                    try:
                        # Send the most minimal valid message with proper CRLF
                        self._writer.write("Content-Length: ")
                        self._writer.write("2")
                        self._writer.write("\r\n\r\n")
                        self._writer.write("{}")
                        self._writer.flush()
                        log_debug("Sent minimal recovery message")
                    except Exception:
                        # At this point we give up
                        pass
                
                # Return False to indicate failure without raising
                return False


class JsonReader:
    """Manages reading JSON-RPC messages from stream."""

    def __init__(self, reader: io.TextIOWrapper, writer: io.TextIOWrapper = None):
        self._reader = reader
        self._writer = writer  # Keep a reference to the writer for error responses

    def close(self):
        """Closes the underlying reader stream."""
        if not self._reader.closed:
            self._reader.close()

    def read(self):
        """Reads data from the stream in JSON-RPC format."""
        if self._reader.closed:
            raise StreamClosedException
        
        # Initialize length to None
        length = None
        headers = {}
        buffer = b''
        
        # Read headers until we find an empty line
        try:
            while True:
                line = self._readline()  # Get raw binary line
                buffer += line  # Add to buffer for possible recovery
                line_str = to_str(line)
                
                if not line_str.strip():
                    # Empty line indicates end of headers
                    break
                    
                # Parse header
                if ':' in line_str:
                    key, value = line_str.split(':', 1)
                    key = key.strip()
                    value = value.strip()
                    headers[key] = value
                    
                    # Check for Content-Length header - CRITICAL
                    if key.lower() == 'content-length':
                        try:
                            length = int(value)
                            print(f"Found Content-Length: {length}")
                        except ValueError:
                            # Invalid Content-Length value
                            print(f"Invalid Content-Length value: {value}")
                            pass
        except Exception as header_error:
            print(f"Error reading headers: {header_error}")
        
        # Log all headers for debugging
        if headers:
            all_headers = ", ".join([f"{k}={v}" for k, v in headers.items()])
            print(f"Read headers: {all_headers}")
        
        # IF Content-Length IS MISSING, WE CANNOT CONTINUE
        # The LSP protocol REQUIRES this header, so we must handle this case specially
        if length is None:
            # Log the error
            log_debug("CRITICAL ERROR: Missing Content-Length header")
            log_debug(f"Buffer so far: {buffer[:100]}...")
            
            # This is critical to diagnose - dump hex representation of the buffer
            hex_buffer = " ".join(f"{b:02x}" for b in buffer[:50])
            log_debug(f"Buffer hex: {hex_buffer}")
            
            # DO NOT try to recovery by reading more - that will cause issues
            # Instead, create and return a valid error response
            error_response = {
                "jsonrpc": "2.0", 
                "error": {
                    "code": -32700,
                    "message": "Missing Content-Length header"
                }, 
                "id": None
            }
            
            # The critical part - we need to ALSO WRITE a proper response
            # with Content-Length header to fix the communication
            try:
                # Try to create a response with proper Content-Length
                error_json = json.dumps(error_response)
                error_bytes = error_json.encode("utf-8")
                error_len = len(error_bytes)
                
                # This is a hack - we're manually writing to the underlying stream
                # but it's necessary to fix the broken protocol state
                if hasattr(self, '_writer') and not getattr(self, '_writer', None).closed:
                    # CRITICAL: Use exactly "Content-Length: " followed by length with proper CRLF
                    self._writer.write(f"Content-Length: {error_len}\r\n")
                    self._writer.write("\r\n") 
                    self._writer.write(error_json)
                    self._writer.flush()
            except Exception as write_err:
                print(f"Failed to write error response: {write_err}")
            
            # Return the error response
            return error_response
        
        # We have a valid length, now read the content
        try:
            # Read exactly the specified number of bytes
            content_bytes = self._reader.read(length)
            if len(content_bytes) < length:
                print(f"Warning: Read {len(content_bytes)} bytes but expected {length}")
            
            # Convert to string and parse as JSON
            content = to_str(content_bytes)
            
            # Parse the JSON
            result = json.loads(content)
            
            # Ensure the result is a dict with jsonrpc field
            if isinstance(result, dict) and "jsonrpc" not in result:
                result["jsonrpc"] = "2.0"
                
            return result
        except json.JSONDecodeError as json_err:
            print(f"JSON decode error with Content-Length={length}: {json_err}")
            print(f"Content: {content_bytes[:100]}...")
            # Return a valid error response
            return {"jsonrpc": "2.0", "error": {"code": -32700, "message": "Invalid JSON"}}
        except Exception as read_err:
            print(f"Error reading content with length {length}: {read_err}")
            # Return a valid error response
            return {"jsonrpc": "2.0", "error": {"code": -32603, "message": f"Internal error: {str(read_err)[:50]}"}}

    def _readline(self):
        """Read a line with error handling."""
        try:
            line = self._reader.readline()
            if not line:
                print("Warning: Received empty line (possible EOF)")
                raise EOFError("Empty line from readline")
            return line
        except Exception as e:
            print(f"Error in _readline: {e}")
            # Return an empty line so the caller can continue
            return b''


class JsonRpc:
    """Manages sending and receiving data over JSON-RPC."""

    def __init__(self, reader: io.TextIOWrapper, writer: io.TextIOWrapper):
        self._writer = JsonWriter(writer)  # Create writer first
        self._reader = JsonReader(reader, writer)  # Pass writer to reader for error responses
        self._lock = threading.Lock()

    def close(self):
        """Closes the underlying streams."""
        with contextlib.suppress(Exception):
            self._reader.close()
        with contextlib.suppress(Exception):
            self._writer.close()

    def send_data(self, data):
        """Send given data in JSON-RPC format."""
        try:
            # Ensure jsonrpc field is present for all messages
            if isinstance(data, dict) and "jsonrpc" not in data:
                data["jsonrpc"] = "2.0"
                
            # The write method now returns a boolean success indicator
            result = self._writer.write(data)
            return result  # Will be True if successful, False if there was an error
        except StreamClosedException:
            # Stream is closed, nothing we can do
            print("Cannot send data - stream is closed")
            return False
        except Exception as e:
            print(f"Error sending data: {e}")
            # Try to send a minimal error message with proper headers
            try:
                error_msg = {"jsonrpc": "2.0", "error": {"code": -32603, "message": f"Send error: {str(e)[:50]}"}}
                self._writer.write(error_msg)
            except Exception:
                pass
            return False

    def receive_data(self):
        """Receive data in JSON-RPC format with enhanced error handling."""
        try:
            # Read data from the stream
            result = self._reader.read()
            
            # Validate the result is a valid JSON-RPC message
            if not isinstance(result, dict):
                print(f"Warning: Received non-dictionary result: {type(result)}")
                error_msg = {"jsonrpc": "2.0", "error": {"code": -32603, "message": "Invalid message format"}, "id": None}
                
                # Also write an error response with proper headers
                self.send_data(error_msg)
                
                return error_msg
                
            # Ensure the result has the jsonrpc field
            if "jsonrpc" not in result:
                result["jsonrpc"] = "2.0"
            
            print(f"Received valid data: {result.keys()}")
            return result
            
        except StreamClosedException:
            # Stream is closed, nothing we can do
            print("Stream is closed")
            # Return a synthetic error response
            error_msg = {"jsonrpc": "2.0", "error": {"code": -32000, "message": "Stream closed"}, "id": None}
            
            # Try to write it if possible (likely will fail)
            try:
                self.send_data(error_msg)
            except Exception:
                pass
                
            return error_msg
            
        except ValueError as e:
            # JSON parsing error or other value error
            print(f"Error receiving data: {e}")
            
            # Special handling for Content-Length errors
            error_code = -32700  # Parse error
            error_message = f"Parse error: {e}"
            
            if "Content-Length" in str(e):
                print("Detected Content-Length header error")
                error_code = -32600  # Invalid Request
                error_message = "Missing Content-Length header"
                
                # This is a critical error that needs special handling
                # We need to re-establish protocol synchronization
                try:
                    # Send a minimal response with proper headers to reset the protocol state
                    self.send_data({
                        "jsonrpc": "2.0", 
                        "error": {
                            "code": error_code,
                            "message": error_message
                        },
                        "id": None
                    })
                except Exception as write_err:
                    print(f"Failed to send error response: {write_err}")
            
            # Return a valid error response
            return {"jsonrpc": "2.0", "error": {"code": error_code, "message": error_message}, "id": None}
            
        except Exception as e:
            # Other unexpected errors
            print(f"Unexpected error receiving data: {e}")
            
            # Create an error response
            error_msg = {"jsonrpc": "2.0", "error": {"code": -32603, "message": f"Internal error: {str(e)[:100]}"}, "id": None}
            
            # Try to send it
            try:
                self.send_data(error_msg)
            except Exception:
                pass
                
            # Return the error response
            return error_msg


def create_json_rpc(readable: BinaryIO, writable: BinaryIO) -> JsonRpc:
    """Creates JSON-RPC wrapper for the readable and writable streams."""
    log_debug("Creating JSON-RPC wrapper with streams")
    
    # CRITICAL: Ensure we're using TextIOWrapper with correct settings
    if not isinstance(readable, io.TextIOWrapper):
        log_debug(f"Converting readable from type {type(readable)} to TextIOWrapper")
        # Use line buffering for reader to ensure we get complete lines
        # CRITICAL: Do not use any line buffering to ensure proper binary handling
        readable = io.TextIOWrapper(readable, encoding='utf-8', errors='replace', 
                                    line_buffering=False)
    if not isinstance(writable, io.TextIOWrapper):
        log_debug(f"Converting writable from type {type(writable)} to TextIOWrapper")
        # Use write_through for writer to ensure immediate flushing
        # CRITICAL: Do not use binary mode transforms here
        writable = io.TextIOWrapper(writable, encoding='utf-8', errors='replace', 
                                    write_through=True)
    
    # Verify the wrappers are in the correct modes
    if hasattr(readable, 'mode'):
        log_debug(f"Reader mode: {readable.mode}")
    if hasattr(writable, 'mode'):
        log_debug(f"Writer mode: {writable.mode}")
    
    # Verify the wrappers are working correctly
    log_debug(f"Finalized JSON-RPC with reader type: {type(readable)}, writer type: {type(writable)}")
    try:
        # Try writing a test header to ensure the writer works with proper CRLF format
        test_msg = '{"jsonrpc": "2.0", "test": true}'
        test_len = len(test_msg.encode('utf-8'))
        
        # CRITICAL: Use this EXACT sequence with separate writes for VSCode compatibility
        writable.write("Content-Length: ")
        writable.write(str(test_len))
        writable.write("\r\n\r\n")
        writable.write(test_msg)
        writable.flush()
        
        log_debug(f"Successfully wrote test message with header, length={test_len}")
    except Exception as e:
        log_debug(f"CRITICAL ERROR: Failed to write test message: {e}")
    
    return JsonRpc(readable, writable)


class ProcessManager:
    """Manages sub-processes launched for running tools."""

    def __init__(self):
        self._args: Dict[str, Sequence[str]] = {}
        self._processes: Dict[str, subprocess.Popen] = {}
        self._rpc: Dict[str, JsonRpc] = {}
        self._lock = threading.Lock()
        self._thread_pool = ThreadPoolExecutor(10)

    def stop_all_processes(self):
        """Send exit command to all processes and shutdown transport."""
        for i in self._rpc.values():
            with contextlib.suppress(Exception):
                i.send_data({"id": str(uuid.uuid4()), "method": "exit"})
        self._thread_pool.shutdown(wait=False)

    def start_process(self, workspace: str, args: Sequence[str], cwd: str) -> None:
        """Starts a process and establishes JSON-RPC communication over stdio."""
        # pylint: disable=consider-using-with
        proc = subprocess.Popen(
            args,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stdin=subprocess.PIPE,
        )
        self._processes[workspace] = proc
        self._rpc[workspace] = create_json_rpc(proc.stdout, proc.stdin)

        def _monitor_process():
            proc.wait()
            with self._lock:
                try:
                    del self._processes[workspace]
                    rpc = self._rpc.pop(workspace)
                    rpc.close()
                except:  # pylint: disable=bare-except
                    pass

        self._thread_pool.submit(_monitor_process)

    def get_json_rpc(self, workspace: str) -> JsonRpc:
        """Gets the JSON-RPC wrapper for the a given id."""
        with self._lock:
            if workspace in self._rpc:
                return self._rpc[workspace]
        raise StreamClosedException()


_process_manager = ProcessManager()
atexit.register(_process_manager.stop_all_processes)


def _get_json_rpc(workspace: str) -> Union[JsonRpc, None]:
    try:
        return _process_manager.get_json_rpc(workspace)
    except StreamClosedException:
        return None
    except KeyError:
        return None


def get_or_start_json_rpc(
    workspace: str, interpreter: Sequence[str], cwd: str
) -> Union[JsonRpc, None]:
    """Gets an existing JSON-RPC connection or starts one and return it."""
    res = _get_json_rpc(workspace)
    if not res:
        args = [*interpreter, RUNNER_SCRIPT]
        _process_manager.start_process(workspace, args, cwd)
        res = _get_json_rpc(workspace)
    return res


class RpcRunResult:
    """Object to hold result from running tool over RPC."""

    def __init__(self, stdout: str, stderr: str, exception: Optional[str] = None):
        self.stdout: str = stdout
        self.stderr: str = stderr
        self.exception: Optional[str] = exception


# pylint: disable=too-many-arguments
def run_over_json_rpc(
    workspace: str,
    interpreter: Sequence[str],
    module: str,
    argv: Sequence[str],
    use_stdin: bool,
    cwd: str,
    source: str = None,
) -> RpcRunResult:
    """Uses JSON-RPC to execute a command."""
    rpc: Union[JsonRpc, None] = get_or_start_json_rpc(workspace, interpreter, cwd)
    if not rpc:
        raise Exception("Failed to run over JSON-RPC.")

    msg_id = str(uuid.uuid4())
    msg = {
        "id": msg_id,
        "method": "run",
        "module": module,
        "argv": argv,
        "useStdin": use_stdin,
        "cwd": cwd,
    }
    if source:
        msg["source"] = source

    rpc.send_data(msg)

    data = rpc.receive_data()

    if data["id"] != msg_id:
        return RpcRunResult(
            "", f"Invalid result for request: {json.dumps(msg, indent=4)}"
        )

    result = data["result"] if "result" in data else ""
    if "error" in data:
        error = data["error"]

        if data.get("exception", False):
            return RpcRunResult(result, "", error)
        return RpcRunResult(result, error)

    return RpcRunResult(result, "")


def shutdown_json_rpc():
    """Shutdown all JSON-RPC processes."""
    _process_manager.stop_all_processes()
