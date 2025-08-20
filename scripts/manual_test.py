#!/usr/bin/env python3
"""
FastChat Manual Test Script

This script helps test the FastChat application by:
1. Starting the backend server
2. Opening multiple browser tabs
3. Testing WebSocket connections
4. Testing chat functionality
5. Providing test scenarios

Usage:
    python scripts/manual_test.py
"""

import os
import sys
import time
import subprocess
import webbrowser
import requests
import json
from pathlib import Path

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(title):
    """Print a formatted header"""
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{title:^60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.END}")

def print_step(step, description):
    """Print a formatted step"""
    print(f"\n{Colors.BOLD}{Colors.GREEN}[STEP {step}]{Colors.END} {description}")

def print_info(message):
    """Print an info message"""
    print(f"{Colors.BLUE}[INFO]{Colors.END} {message}")

def print_success(message):
    """Print a success message"""
    print(f"{Colors.GREEN}[SUCCESS]{Colors.END} {message}")

def print_warning(message):
    """Print a warning message"""
    print(f"{Colors.YELLOW}[WARNING]{Colors.END} {message}")

def print_error(message):
    """Print an error message"""
    print(f"{Colors.RED}[ERROR]{Colors.END} {message}")

def check_backend_health():
    """Check if backend is running and healthy"""
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            return True
    except requests.exceptions.RequestException:
        pass
    return False

def check_database_health():
    """Check database connectivity"""
    try:
        response = requests.get("http://localhost:8000/health/db", timeout=5)
        if response.status_code == 200:
            data = response.json()
            return data.get("database") == "connected"
    except requests.exceptions.RequestException:
        pass
    return False

def start_backend():
    """Start the backend server"""
    print_step(1, "Starting Backend Server")
    
    # Check if backend is already running
    if check_backend_health():
        print_success("Backend is already running!")
        return None
    
    # Change to backend directory
    backend_dir = Path(__file__).parent.parent / "backend"
    os.chdir(backend_dir)
    
    # Start the server
    print_info("Starting FastAPI server with uvicorn...")
    try:
        process = subprocess.Popen([
            "uvicorn", "app.main:app", 
            "--host", "0.0.0.0", 
            "--port", "8000", 
            "--reload"
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        # Wait for server to start
        for i in range(30):
            time.sleep(1)
            if check_backend_health():
                print_success("Backend server started successfully!")
                return process
        
        print_error("Backend server failed to start within 30 seconds")
        process.terminate()
        return None
        
    except Exception as e:
        print_error(f"Failed to start backend: {e}")
        return None

def open_browser_tabs():
    """Open multiple browser tabs for testing"""
    print_step(2, "Opening Browser Tabs for Testing")
    
    frontend_url = "http://localhost:3000"
    
    # Check if frontend is accessible
    try:
        response = requests.get(frontend_url, timeout=5)
        if response.status_code != 200:
            print_warning("Frontend not accessible. Make sure to start it with 'npm run dev'")
    except requests.exceptions.RequestException:
        print_warning("Frontend not accessible. Make sure to start it with 'npm run dev'")
    
    # Open multiple tabs
    tabs = [
        f"{frontend_url}?user=Alice",
        f"{frontend_url}?user=Bob", 
        f"{frontend_url}?user=Charlie"
    ]
    
    for i, url in enumerate(tabs, 1):
        print_info(f"Opening tab {i}: {url}")
        webbrowser.open(url)
        time.sleep(1)
    
    print_success(f"Opened {len(tabs)} browser tabs")

def test_api_endpoints():
    """Test API endpoints"""
    print_step(3, "Testing API Endpoints")
    
    endpoints = [
        ("GET /health", "http://localhost:8000/health"),
        ("GET /health/db", "http://localhost:8000/health/db"),
        ("GET /docs", "http://localhost:8000/docs"),
    ]
    
    for name, url in endpoints:
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                print_success(f"{name}: OK")
            else:
                print_error(f"{name}: HTTP {response.status_code}")
        except requests.exceptions.RequestException as e:
            print_error(f"{name}: Failed - {e}")

def test_presence_api():
    """Test presence API endpoints"""
    print_step(4, "Testing Presence API")
    
    # Test heartbeat endpoint
    heartbeat_data = {
        "user_id": "test-user-123",
        "display_name": "Test User"
    }
    
    try:
        response = requests.post(
            "http://localhost:8000/presence/heartbeat",
            json=heartbeat_data,
            timeout=5
        )
        if response.status_code == 200:
            print_success("POST /presence/heartbeat: OK")
        else:
            print_error(f"POST /presence/heartbeat: HTTP {response.status_code}")
    except requests.exceptions.RequestException as e:
        print_error(f"POST /presence/heartbeat: Failed - {e}")
    
    # Test online users endpoint
    try:
        response = requests.get("http://localhost:8000/presence/online", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print_success(f"GET /presence/online: OK ({len(data.get('users', []))} users)")
        else:
            print_error(f"GET /presence/online: HTTP {response.status_code}")
    except requests.exceptions.RequestException as e:
        print_error(f"GET /presence/online: Failed - {e}")

def print_test_scenarios():
    """Print manual test scenarios"""
    print_step(5, "Manual Test Scenarios")
    
    scenarios = [
        {
            "title": "User Connection Test",
            "steps": [
                "Open multiple browser tabs",
                "Verify each user gets a unique ID and random name",
                "Check that users appear in the online users list",
                "Verify connection status banner shows 'Connected'"
            ]
        },
        {
            "title": "Presence Management Test",
            "steps": [
                "Open 3-4 browser tabs",
                "Verify all users appear in the online users list",
                "Close one tab and wait 30 seconds",
                "Verify the user disappears from the online list",
                "Reopen the tab and verify they reappear"
            ]
        },
        {
            "title": "Chat Functionality Test",
            "steps": [
                "Click on a user in the online users list",
                "Verify the chat pane opens",
                "Type a message and press Enter",
                "Verify the message appears in the chat",
                "Check the other user's tab to see the message",
                "Test typing indicators by typing slowly"
            ]
        },
        {
            "title": "Error Handling Test",
            "steps": [
                "Stop the backend server",
                "Verify connection status shows 'Disconnected'",
                "Try to send a message (should be disabled)",
                "Restart the backend server",
                "Verify reconnection and message sending works"
            ]
        },
        {
            "title": "WebSocket Protocol Test",
            "steps": [
                "Open browser developer tools",
                "Go to Network tab and filter by WS",
                "Verify WebSocket connection is established",
                "Send messages and verify WebSocket frames",
                "Check for proper message acknowledgments"
            ]
        }
    ]
    
    for i, scenario in enumerate(scenarios, 1):
        print(f"\n{Colors.BOLD}{Colors.PURPLE}Scenario {i}: {scenario['title']}{Colors.END}")
        for j, step in enumerate(scenario['steps'], 1):
            print(f"  {j}. {step}")

def print_troubleshooting():
    """Print troubleshooting tips"""
    print_step(6, "Troubleshooting Tips")
    
    tips = [
        "If backend won't start: Check if port 8000 is available",
        "If frontend won't load: Run 'npm run dev' in frontend directory",
        "If WebSocket fails: Check CORS settings and browser console",
        "If database errors: Verify DATABASE_URL in .env file",
        "If messages don't appear: Check WebSocket connection status",
        "If users don't show online: Check presence service logs"
    ]
    
    for tip in tips:
        print(f"• {tip}")

def main():
    """Main test script"""
    print_header("FastChat Manual Test Script")
    
    print_info("This script will help you test the FastChat application")
    print_info("Make sure you have:")
    print_info("  • Backend dependencies installed (pip install -r requirements.txt)")
    print_info("  • Frontend dependencies installed (npm install)")
    print_info("  • Database configured (.env file with DATABASE_URL)")
    
    # Start backend
    backend_process = start_backend()
    
    if backend_process is None and not check_backend_health():
        print_error("Cannot proceed without backend server")
        sys.exit(1)
    
    # Test database connectivity
    if check_database_health():
        print_success("Database connection: OK")
    else:
        print_warning("Database connection: Failed - check your DATABASE_URL")
    
    # Test API endpoints
    test_api_endpoints()
    
    # Test presence API
    test_presence_api()
    
    # Open browser tabs
    open_browser_tabs()
    
    # Print test scenarios
    print_test_scenarios()
    
    # Print troubleshooting
    print_troubleshooting()
    
    print_header("Test Setup Complete")
    print_info("You can now manually test the application in the browser tabs")
    print_info("Press Ctrl+C to stop the backend server when done")
    
    try:
        if backend_process:
            backend_process.wait()
    except KeyboardInterrupt:
        print_info("\nStopping backend server...")
        if backend_process:
            backend_process.terminate()
        print_success("Test completed!")

if __name__ == "__main__":
    main()
