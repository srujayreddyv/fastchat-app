#!/usr/bin/env python3
"""
Neon Database Setup Script for FastChat

This script helps you set up your Neon database connection.
"""

import os
import sys
from pathlib import Path

def main():
    print("🚀 FastChat Neon Database Setup")
    print("=" * 40)
    
    # Check if .env file exists
    env_file = Path(".env")
    if env_file.exists():
        print("✅ .env file already exists")
        response = input("Do you want to overwrite it? (y/N): ").lower()
        if response != 'y':
            print("Setup cancelled.")
            return
    
    # Get Neon connection string
    print("\n📋 Please provide your Neon database connection string:")
    print("You can find this in your Neon Console: https://console.neon.tech/")
    print("Format: postgresql://[user]:[password]@[endpoint]/[dbname]?sslmode=require")
    
    database_url = input("\nEnter your DATABASE_URL: ").strip()
    
    if not database_url:
        print("❌ No database URL provided. Setup cancelled.")
        return
    
    # Create .env file
    env_content = f"""# Database Configuration (Neon)
DATABASE_URL={database_url}

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=true

# Security
SECRET_KEY=your-secret-key-here-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Frontend Configuration
FRONTEND_URL=http://localhost:3000

# WebSocket Configuration
WS_HOST=0.0.0.0
WS_PORT=8001
"""
    
    try:
        with open(".env", "w") as f:
            f.write(env_content)
        print("✅ .env file created successfully!")
        
        # Test database connection
        print("\n🔍 Testing database connection...")
        os.environ["DATABASE_URL"] = database_url
        
        try:
            from backend.app.database import engine
            with engine.connect() as conn:
                conn.execute("SELECT 1")
            print("✅ Database connection successful!")
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            print("Please check your connection string and try again.")
            return
        
        print("\n🎉 Setup complete! You can now run your application.")
        print("\nNext steps:")
        print("1. Run database migrations: cd backend && alembic upgrade head")
        print("2. Start the backend: cd backend && uvicorn app.main:app --reload")
        print("3. Start the frontend: cd frontend && npm run dev")
        
    except Exception as e:
        print(f"❌ Error creating .env file: {e}")
        return

if __name__ == "__main__":
    main()
