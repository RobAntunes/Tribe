"""
Comprehensive state management system for the Tribe extension.
Provides a unified approach to state management with CrewAI integration.
"""

from typing import Dict, Any, List, Optional, Callable, Union, TypeVar, Generic
from pydantic import BaseModel, Field
import asyncio
import json
import logging
import uuid
import time
from datetime import datetime
from enum import Enum
import os
import threading
from collections import defaultdict

# Generic type for state models
T = TypeVar('T', bound=BaseModel)

class StateChangeType(str, Enum):
    """Types of state changes"""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    REPLACE = "replace"
    APPEND = "append"
    REMOVE = "remove"

class StateChange(BaseModel):
    """Model for tracking state changes"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    path: str
    change_type: StateChangeType
    timestamp: float = Field(default_factory=time.time)
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    initiator: str = "system"  # Can be "system", "agent:<id>", "user", etc.

class StateEventType(str, Enum):
    """Types of state events"""
    CHANGE = "change"
    TRANSACTION_BEGIN = "transaction_begin"
    TRANSACTION_COMMIT = "transaction_commit"
    TRANSACTION_ROLLBACK = "transaction_rollback"
    SYNC = "sync"
    ERROR = "error"

class StateEvent(BaseModel):
    """Event emitted when state changes"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: StateEventType
    timestamp: float = Field(default_factory=time.time)
    data: Dict[str, Any] = Field(default_factory=dict)
    
class StateTransaction(BaseModel):
    """Model for transactions that batch state changes"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    changes: List[StateChange] = Field(default_factory=list)
    timestamp_start: float = Field(default_factory=time.time)
    timestamp_end: Optional[float] = None
    status: str = "in_progress"  # "in_progress", "committed", "rolled_back"
    metadata: Dict[str, Any] = Field(default_factory=dict)
    initiator: str = "system"

class StateManager(Generic[T]):
    """
    Comprehensive state management system with transactions, events, and history.
    Integrates with CrewAI for agent-aware state management.
    """
    
    def __init__(self, initial_state: T, history_size: int = 100):
        """
        Initialize the state manager.
        
        Args:
            initial_state: Initial state object
            history_size: Number of state changes to keep in history
        """
        self._state = initial_state
        self._history: List[StateChange] = []
        self._history_size = history_size
        self._transactions: Dict[str, StateTransaction] = {}
        self._active_transaction: Optional[str] = None
        self._subscribers: Dict[str, List[Callable[[StateEvent], None]]] = defaultdict(list)
        self._lock = threading.RLock()
        self._event_queue = asyncio.Queue()
        self._is_processing_events = False
        self._logger = logging.getLogger("state_manager")
        
        # Start event processing loop
        asyncio.create_task(self._process_events())
    
    @property
    def state(self) -> T:
        """Get the current state"""
        with self._lock:
            return self._state
    
    async def update(self, path: str, value: Any, initiator: str = "system") -> StateChange:
        """
        Update a value at the specified path.
        
        Args:
            path: Path to the state property (dot notation)
            value: New value to set
            initiator: Who/what initiated this change
            
        Returns:
            StateChange object representing the change
        """
        with self._lock:
            # Get the old value
            old_value = self._get_value_at_path(path)
            
            # Create the change object
            change = StateChange(
                path=path,
                change_type=StateChangeType.UPDATE,
                old_value=old_value,
                new_value=value,
                initiator=initiator
            )
            
            # Apply the change
            if self._active_transaction:
                # Add to transaction
                self._transactions[self._active_transaction].changes.append(change)
            else:
                # Apply immediately
                self._apply_change(change)
                
            return change
    
    async def create(self, path: str, value: Any, initiator: str = "system") -> StateChange:
        """
        Create a new value at the specified path.
        
        Args:
            path: Path to the state property (dot notation)
            value: Value to create
            initiator: Who/what initiated this change
            
        Returns:
            StateChange object representing the change
        """
        with self._lock:
            # Ensure the path doesn't already exist
            if self._path_exists(path):
                raise ValueError(f"Cannot create: Path '{path}' already exists")
                
            # Create the change object
            change = StateChange(
                path=path,
                change_type=StateChangeType.CREATE,
                old_value=None,
                new_value=value,
                initiator=initiator
            )
            
            # Apply the change
            if self._active_transaction:
                # Add to transaction
                self._transactions[self._active_transaction].changes.append(change)
            else:
                # Apply immediately
                self._apply_change(change)
                
            return change
    
    async def delete(self, path: str, initiator: str = "system") -> StateChange:
        """
        Delete a value at the specified path.
        
        Args:
            path: Path to the state property (dot notation)
            initiator: Who/what initiated this change
            
        Returns:
            StateChange object representing the change
        """
        with self._lock:
            # Get the old value
            old_value = self._get_value_at_path(path)
            
            # Create the change object
            change = StateChange(
                path=path,
                change_type=StateChangeType.DELETE,
                old_value=old_value,
                new_value=None,
                initiator=initiator
            )
            
            # Apply the change
            if self._active_transaction:
                # Add to transaction
                self._transactions[self._active_transaction].changes.append(change)
            else:
                # Apply immediately
                self._apply_change(change)
                
            return change
    
    async def append(self, path: str, value: Any, initiator: str = "system") -> StateChange:
        """
        Append a value to a list at the specified path.
        
        Args:
            path: Path to the list property (dot notation)
            value: Value to append
            initiator: Who/what initiated this change
            
        Returns:
            StateChange object representing the change
        """
        with self._lock:
            # Get the old value
            old_value = self._get_value_at_path(path)
            
            if not isinstance(old_value, list):
                raise ValueError(f"Cannot append: Path '{path}' is not a list")
                
            # Create new value (copy to avoid modifications)
            new_value = old_value.copy()
            new_value.append(value)
            
            # Create the change object
            change = StateChange(
                path=path,
                change_type=StateChangeType.APPEND,
                old_value=old_value,
                new_value=new_value,
                initiator=initiator
            )
            
            # Apply the change
            if self._active_transaction:
                # Add to transaction
                self._transactions[self._active_transaction].changes.append(change)
            else:
                # Apply immediately
                self._apply_change(change)
                
            return change
    
    async def remove(self, path: str, value: Any, initiator: str = "system") -> StateChange:
        """
        Remove a value from a list at the specified path.
        
        Args:
            path: Path to the list property (dot notation)
            value: Value to remove (can be index or matching value)
            initiator: Who/what initiated this change
            
        Returns:
            StateChange object representing the change
        """
        with self._lock:
            # Get the old value
            old_value = self._get_value_at_path(path)
            
            if not isinstance(old_value, list):
                raise ValueError(f"Cannot remove: Path '{path}' is not a list")
                
            # Create new value (copy to avoid modifications)
            new_value = old_value.copy()
            
            if isinstance(value, int) and 0 <= value < len(new_value):
                # Remove by index
                new_value.pop(value)
            else:
                # Remove by value
                if value in new_value:
                    new_value.remove(value)
                else:
                    raise ValueError(f"Value {value} not found in list at path '{path}'")
            
            # Create the change object
            change = StateChange(
                path=path,
                change_type=StateChangeType.REMOVE,
                old_value=old_value,
                new_value=new_value,
                initiator=initiator
            )
            
            # Apply the change
            if self._active_transaction:
                # Add to transaction
                self._transactions[self._active_transaction].changes.append(change)
            else:
                # Apply immediately
                self._apply_change(change)
                
            return change
    
    async def replace(self, path: str, value: Any, initiator: str = "system") -> StateChange:
        """
        Replace the entire value at the specified path.
        
        Args:
            path: Path to the state property (dot notation)
            value: New value to set
            initiator: Who/what initiated this change
            
        Returns:
            StateChange object representing the change
        """
        with self._lock:
            # Get the old value
            old_value = self._get_value_at_path(path)
            
            # Create the change object
            change = StateChange(
                path=path,
                change_type=StateChangeType.REPLACE,
                old_value=old_value,
                new_value=value,
                initiator=initiator
            )
            
            # Apply the change
            if self._active_transaction:
                # Add to transaction
                self._transactions[self._active_transaction].changes.append(change)
            else:
                # Apply immediately
                self._apply_change(change)
                
            return change
    
    async def begin_transaction(self, name: str, initiator: str = "system") -> str:
        """
        Begin a new transaction.
        
        Args:
            name: Name of the transaction
            initiator: Who/what initiated this transaction
            
        Returns:
            Transaction ID
        """
        with self._lock:
            if self._active_transaction:
                raise ValueError("Cannot begin a new transaction while another is active")
                
            transaction = StateTransaction(
                name=name,
                initiator=initiator
            )
            
            self._transactions[transaction.id] = transaction
            self._active_transaction = transaction.id
            
            # Emit transaction begin event
            await self._emit_event(StateEventType.TRANSACTION_BEGIN, {
                "transaction_id": transaction.id,
                "name": name,
                "initiator": initiator
            })
            
            return transaction.id
    
    async def commit_transaction(self) -> List[StateChange]:
        """
        Commit the active transaction.
        
        Returns:
            List of state changes that were applied
        """
        with self._lock:
            if not self._active_transaction:
                raise ValueError("No active transaction to commit")
                
            transaction = self._transactions[self._active_transaction]
            transaction.status = "committed"
            transaction.timestamp_end = time.time()
            
            # Apply all changes
            applied_changes = []
            for change in transaction.changes:
                self._apply_change(change)
                applied_changes.append(change)
            
            # Clear the active transaction
            self._active_transaction = None
            
            # Emit transaction commit event
            await self._emit_event(StateEventType.TRANSACTION_COMMIT, {
                "transaction_id": transaction.id,
                "name": transaction.name,
                "changes_count": len(applied_changes)
            })
            
            return applied_changes
    
    async def rollback_transaction(self) -> None:
        """Rollback the active transaction."""
        with self._lock:
            if not self._active_transaction:
                raise ValueError("No active transaction to rollback")
                
            transaction = self._transactions[self._active_transaction]
            transaction.status = "rolled_back"
            transaction.timestamp_end = time.time()
            
            # Clear the active transaction
            self._active_transaction = None
            
            # Emit transaction rollback event
            await self._emit_event(StateEventType.TRANSACTION_ROLLBACK, {
                "transaction_id": transaction.id,
                "name": transaction.name,
                "changes_count": len(transaction.changes)
            })
    
    def subscribe(self, event_type: StateEventType, callback: Callable[[StateEvent], None]) -> str:
        """
        Subscribe to state events.
        
        Args:
            event_type: Type of event to subscribe to
            callback: Function to call when event occurs
            
        Returns:
            Subscription ID
        """
        with self._lock:
            subscription_id = str(uuid.uuid4())
            self._subscribers[event_type.value].append(callback)
            return subscription_id
    
    def unsubscribe(self, subscription_id: str) -> None:
        """
        Unsubscribe from state events.
        
        Args:
            subscription_id: Subscription ID to remove
        """
        with self._lock:
            # This is a simplified implementation - a real one would track which callback
            # is associated with each subscription ID
            pass
    
    def get_history(self) -> List[StateChange]:
        """Get the history of state changes"""
        with self._lock:
            return self._history.copy()
    
    def get_value(self, path: str) -> Any:
        """
        Get a value at the specified path.
        
        Args:
            path: Path to the state property (dot notation)
            
        Returns:
            Value at the path
        """
        with self._lock:
            return self._get_value_at_path(path)
    
    def _get_value_at_path(self, path: str) -> Any:
        """Internal method to get a value at a path"""
        if not path:
            return self._state.dict()
            
        current = self._state.dict()
        parts = path.split('.')
        
        try:
            for part in parts:
                if part.isdigit() and isinstance(current, list):
                    idx = int(part)
                    if 0 <= idx < len(current):
                        current = current[idx]
                    else:
                        raise ValueError(f"Index {idx} out of range for list at path '{path}'")
                elif isinstance(current, dict) and part in current:
                    current = current[part]
                else:
                    raise ValueError(f"Path '{path}' does not exist")
            return current
        except (KeyError, IndexError):
            raise ValueError(f"Path '{path}' does not exist")
    
    def _set_value_at_path(self, path: str, value: Any) -> None:
        """Internal method to set a value at a path"""
        if not path:
            # Cannot replace entire state
            raise ValueError("Cannot set value at empty path")
            
        state_dict = self._state.dict()
        parts = path.split('.')
        current = state_dict
        
        # Navigate to the parent node
        for i, part in enumerate(parts[:-1]):
            if part.isdigit() and isinstance(current, list):
                idx = int(part)
                if 0 <= idx < len(current):
                    current = current[idx]
                else:
                    raise ValueError(f"Index {idx} out of range for list at path '{'.'.join(parts[:i+1])}'")
            elif isinstance(current, dict):
                if part not in current:
                    current[part] = {}
                current = current[part]
            else:
                raise ValueError(f"Cannot set value at path '{path}': parent is not a dict or list")
        
        # Set the value at the leaf node
        last_part = parts[-1]
        if last_part.isdigit() and isinstance(current, list):
            idx = int(last_part)
            if 0 <= idx < len(current):
                current[idx] = value
            else:
                raise ValueError(f"Index {idx} out of range for list at path '{path}'")
        elif isinstance(current, dict):
            current[last_part] = value
        else:
            raise ValueError(f"Cannot set value at path '{path}': parent is not a dict or list")
        
        # Update the state
        self._state = self._state.__class__.parse_obj(state_dict)
    
    def _delete_value_at_path(self, path: str) -> None:
        """Internal method to delete a value at a path"""
        if not path:
            # Cannot delete entire state
            raise ValueError("Cannot delete value at empty path")
            
        state_dict = self._state.dict()
        parts = path.split('.')
        current = state_dict
        
        # Navigate to the parent node
        for i, part in enumerate(parts[:-1]):
            if part.isdigit() and isinstance(current, list):
                idx = int(part)
                if 0 <= idx < len(current):
                    current = current[idx]
                else:
                    raise ValueError(f"Index {idx} out of range for list at path '{'.'.join(parts[:i+1])}'")
            elif isinstance(current, dict) and part in current:
                current = current[part]
            else:
                raise ValueError(f"Path '{path}' does not exist")
        
        # Delete the value at the leaf node
        last_part = parts[-1]
        if last_part.isdigit() and isinstance(current, list):
            idx = int(last_part)
            if 0 <= idx < len(current):
                current.pop(idx)
            else:
                raise ValueError(f"Index {idx} out of range for list at path '{path}'")
        elif isinstance(current, dict) and last_part in current:
            del current[last_part]
        else:
            raise ValueError(f"Path '{path}' does not exist")
        
        # Update the state
        self._state = self._state.__class__.parse_obj(state_dict)
    
    def _path_exists(self, path: str) -> bool:
        """Check if a path exists in the state"""
        try:
            self._get_value_at_path(path)
            return True
        except ValueError:
            return False
    
    def _apply_change(self, change: StateChange) -> None:
        """Apply a state change"""
        try:
            if change.change_type == StateChangeType.CREATE or change.change_type == StateChangeType.UPDATE or change.change_type == StateChangeType.REPLACE:
                self._set_value_at_path(change.path, change.new_value)
            elif change.change_type == StateChangeType.DELETE:
                self._delete_value_at_path(change.path)
            elif change.change_type == StateChangeType.APPEND:
                # For append/remove, we just set the entire new list
                self._set_value_at_path(change.path, change.new_value)
            elif change.change_type == StateChangeType.REMOVE:
                # For append/remove, we just set the entire new list
                self._set_value_at_path(change.path, change.new_value)
                
            # Add to history
            self._history.append(change)
            
            # Trim history if needed
            if len(self._history) > self._history_size:
                self._history = self._history[-self._history_size:]
                
            # Emit change event
            asyncio.create_task(self._emit_event(StateEventType.CHANGE, {
                "change": change.dict()
            }))
        except Exception as e:
            self._logger.error(f"Error applying change: {e}")
            asyncio.create_task(self._emit_event(StateEventType.ERROR, {
                "error": str(e),
                "change": change.dict()
            }))
            raise
    
    async def _emit_event(self, event_type: StateEventType, data: Dict[str, Any]) -> None:
        """Emit a state event"""
        event = StateEvent(
            type=event_type,
            data=data
        )
        
        # Add to event queue for async processing
        await self._event_queue.put(event)
    
    async def _process_events(self) -> None:
        """Process events from the queue"""
        self._is_processing_events = True
        
        try:
            while True:
                # Get next event
                event = await self._event_queue.get()
                
                # Process event
                try:
                    # Get subscribers for this event type
                    subscribers = self._subscribers.get(event.type.value, []).copy()
                    
                    # Call subscribers
                    for callback in subscribers:
                        try:
                            callback(event)
                        except Exception as e:
                            self._logger.error(f"Error in subscriber callback: {e}")
                finally:
                    # Mark task as done
                    self._event_queue.task_done()
        except asyncio.CancelledError:
            self._logger.info("Event processing cancelled")
            self._is_processing_events = False
        except Exception as e:
            self._logger.error(f"Error in event processing: {e}")
            self._is_processing_events = False
            
            # Restart event processing
            asyncio.create_task(self._process_events())
            

# Example state models and usage
class AgentState(BaseModel):
    """Model for agent state"""
    id: str
    name: str
    role: str
    status: str = "ready"
    tools: List[str] = Field(default_factory=list)
    memory: Dict[str, Any] = Field(default_factory=dict)
    collaboration_mode: str = "default"
    performance_metrics: Dict[str, float] = Field(default_factory=dict)

class TeamState(BaseModel):
    """Model for team state"""
    id: str
    name: str
    description: str
    agents: List[str] = Field(default_factory=list)
    tasks: List[str] = Field(default_factory=list)
    workflows: List[str] = Field(default_factory=dict)
    status: str = "active"

class TaskState(BaseModel):
    """Model for task state"""
    id: str
    description: str
    status: str = "pending"
    assigned_to: Optional[str] = None
    priority: int = 0
    dependencies: List[str] = Field(default_factory=list)
    progress: float = 0.0
    metadata: Dict[str, Any] = Field(default_factory=dict)

class WorkflowState(BaseModel):
    """Model for workflow state"""
    id: str
    name: str
    description: str
    steps: List[Dict[str, Any]] = Field(default_factory=list)
    status: str = "pending"
    current_step: int = 0
    metadata: Dict[str, Any] = Field(default_factory=dict)

class SystemState(BaseModel):
    """Root state model for the Tribe extension"""
    agents: Dict[str, AgentState] = Field(default_factory=dict)
    teams: Dict[str, TeamState] = Field(default_factory=dict)
    tasks: Dict[str, TaskState] = Field(default_factory=dict)
    workflows: Dict[str, WorkflowState] = Field(default_factory=dict)
    settings: Dict[str, Any] = Field(default_factory=dict)
    history: List[Dict[str, Any]] = Field(default_factory=list)
    stats: Dict[str, Any] = Field(default_factory=dict)