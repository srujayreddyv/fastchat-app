import os
import pathlib
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
from dotenv import load_dotenv

# Load environment variables from .env file
project_root = pathlib.Path(__file__).parent.parent.parent
load_dotenv(dotenv_path=project_root / ".env")

# Get database URL from environment variable
DATABASE_URL = os.getenv("DATABASE_URL")

# Create SQLAlchemy engine with appropriate configuration
if DATABASE_URL:
    if DATABASE_URL.startswith("sqlite"):
        # SQLite configuration for local development
        engine = create_engine(
            DATABASE_URL,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool
        )
    elif DATABASE_URL.startswith("postgres://"):
        # Convert postgres:// to postgresql:// for SQLAlchemy compatibility
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        engine = create_engine(
            DATABASE_URL,
            poolclass=StaticPool,  # Use StaticPool for serverless environments
            connect_args={
                "sslmode": "require",  # Required for Neon
            } if "neon" in DATABASE_URL else {}
        )
    else:
        # Default PostgreSQL configuration
        engine = create_engine(
            DATABASE_URL,
            poolclass=StaticPool
        )
else:
    # Fallback for when DATABASE_URL is not set (e.g., during migrations)
    engine = None

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) if engine else None

# Create Base class for models
Base = declarative_base()

# Dependency to get database session
def get_db():
    if SessionLocal is None:
        raise Exception("Database not configured. Please set DATABASE_URL environment variable.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
