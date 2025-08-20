# FastChat

Real-time chat app built with **FastAPI**, **PostgreSQL**, and **React**.

## Features

- User signup/login
- Real-time messaging (WebSocket)
- Presence tracking (who’s online)
- PostgreSQL database with SQLAlchemy
- React frontend with WebSocket integration

## Getting Started

1. Clone repo
2. Setup Python venv + install backend dependencies (`pip install -r requirements.txt`)
3. Setup frontend (`cd frontend && npm install`)
4. Run backend: `uvicorn app.main:app --reload --app-dir backend`
5. Run frontend: `npm start`
