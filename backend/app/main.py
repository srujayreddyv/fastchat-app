from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import logging
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
from sqlalchemy import text
import pathlib
from dotenv import load_dotenv
from .database import get_db, engine
from .routers import websocket, presence, metrics
from .websocket_manager import connection_manager

# Load environment variables from .env file (in project root)
project_root = pathlib.Path(__file__).parent.parent.parent
load_dotenv(dotenv_path=project_root / ".env")

# Validate required environment variables
required_env_vars = ["DATABASE_URL"]
missing_vars = [var for var in required_env_vars if not os.getenv(var)]
if missing_vars:
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting FastChat application...")
    await connection_manager.start_background_tasks()
    logger.info("FastChat application started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down FastChat application...")
    await connection_manager.stop_background_tasks()
    logger.info("FastChat application shut down successfully")

# Create FastAPI app with lifespan management
app = FastAPI(
    title="FastChat API",
    description="Real-time chat application with WebSocket support",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include routers
app.include_router(presence.router)
app.include_router(websocket.router)
app.include_router(metrics.router)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.options("/health")
def health_options():
    return {"status": "ok"}

@app.get("/health/db")
def health_db(db: Session = Depends(get_db)):
    """Check database connectivity"""
    try:
        # Test database connection
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}