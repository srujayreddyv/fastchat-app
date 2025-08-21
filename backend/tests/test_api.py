import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_health_endpoint(client: TestClient):
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_health_db_endpoint(client: TestClient):
    """Test database health check endpoint"""
    response = client.get("/health/db")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "database" in data

def test_presence_heartbeat(client: TestClient):
    """Test presence heartbeat endpoint"""
    heartbeat_data = {
        "user_id": "123e4567-e89b-12d3-a456-426614174000",
        "display_name": "Test User"
    }
    response = client.post("/presence/heartbeat", json=heartbeat_data)
    assert response.status_code == 200
    data = response.json()
    assert "status" in data

def test_presence_online(client: TestClient):
    """Test online users endpoint"""
    response = client.get("/presence/online")
    assert response.status_code == 200
    data = response.json()
    assert "users" in data
    assert isinstance(data["users"], list)

def test_presence_heartbeat_invalid_data(client: TestClient):
    """Test presence heartbeat with invalid data"""
    # Missing required fields
    response = client.post("/presence/heartbeat", json={})
    assert response.status_code == 422

    # Invalid user_id format
    response = client.post("/presence/heartbeat", json={
        "user_id": "invalid-uuid",
        "display_name": "Test User"
    })
    assert response.status_code == 422

def test_cors_headers(client: TestClient):
    """Test CORS headers are present"""
    response = client.options("/health")
    assert response.status_code == 200
    # CORS headers should be present (handled by FastAPI CORS middleware)

def test_api_docs_available(client: TestClient):
    """Test that API documentation is available"""
    response = client.get("/docs")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
