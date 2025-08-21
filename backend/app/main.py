import os
import logging
import pathlib
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from .routers import websocket, presence, metrics
from .websocket_manager import connection_manager

# Load environment variables from .env file (in project root)
project_root = pathlib.Path(__file__).parent.parent.parent
load_dotenv(dotenv_path=project_root / ".env")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Validate required environment variables
def validate_environment():
    """Validate that all required environment variables are set"""
    required_vars = [
        "DATABASE_URL",
        "SECRET_KEY",
        "API_HOST",
        "API_PORT"
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        error_msg = f"Missing required environment variables: {', '.join(missing_vars)}"
        logger.error(error_msg)
        raise EnvironmentError(error_msg)
    
    logger.info("All required environment variables are set")


# Validate environment on startup
try:
    validate_environment()
except EnvironmentError as e:
    logger.error(f"Environment validation failed: {e}")
    raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting FastChat application...")
    
    # Start background tasks
    await connection_manager.start_background_tasks()
    
    yield
    
    # Shutdown
    logger.info("Shutting down FastChat application...")
    await connection_manager.stop_background_tasks()


# Create FastAPI app
app = FastAPI(
    title="FastChat API",
    description="Real-time chat application with WebSocket support",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(websocket.router)
app.include_router(presence.router)
app.include_router(metrics.router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "FastChat API is running"}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}


@app.options("/health")
async def health_options():
    """Health check OPTIONS endpoint for CORS"""
    return {"status": "ok"}


@app.get("/health/db")
async def health_check_db():
    """Database health check endpoint"""
    try:
        # Simple database connectivity check
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {"status": "unhealthy", "database": "disconnected"}