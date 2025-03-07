import os
import requests
import sys
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

api_key = os.getenv("ANTHROPIC_API_KEY")
if not api_key:
    print("ERROR: ANTHROPIC_API_KEY not found in environment variables")
    sys.exit(1)

print(f"Testing API key: {api_key[:8]}...{api_key[-4:]}")

# Test the API key with a simple request
base_url = "https://api.anthropic.com/v1/messages"
headers = {
    "Content-Type": "application/json",
    "x-api-key": api_key,
    "anthropic-version": "2023-06-01",
}

data = {
    "model": "claude-3-7-sonnet-20250219",
    "max_tokens": 100,
    "messages": [
        {"role": "user", "content": "Hello, are you working? Please respond with a simple yes or no."}
    ]
}

try:
    start_time = time.time()
    response = requests.post(base_url, headers=headers, json=data)
    elapsed = time.time() - start_time
    
    if response.status_code == 200:
        print(f"SUCCESS: API key is valid (response time: {elapsed:.2f}s)")
        result = response.json()
        print(f"Response: {result['content'][0]['text']}")
    else:
        print(f"ERROR: API returned status code {response.status_code}")
        print(f"Response: {response.text}")
except Exception as e:
    print(f"ERROR: Exception occurred: {str(e)}") 