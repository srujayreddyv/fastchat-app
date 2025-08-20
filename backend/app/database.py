import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Get database URL from environment variable
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    # Convert postgres:// to postgresql:// for SQLAlchemy compatibility
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Create SQLAlchemy engine with Neon-specific configurations
if DATABASE_URL:
    engine = create_engine(
        DATABASE_URL,
        poolclass=StaticPool,  # Use StaticPool for serverless environments
        connect_args={
            "sslmode": "require",  # Required for Neon
        } if "neon" in DATABASE_URL else {}
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
