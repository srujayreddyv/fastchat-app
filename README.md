# FastChat

Real-time chat app built with **FastAPI**, **PostgreSQL**, and **React**.

## Features

- User signup/login
- Real-time messaging (WebSocket)
- Presence tracking (who's online)
- PostgreSQL database with SQLAlchemy
- React frontend with WebSocket integration

## Tech Stack

### Backend

- **FastAPI** - Modern, fast web framework for building APIs
- **PostgreSQL** - Reliable, open-source database
- **SQLAlchemy** - SQL toolkit and ORM
- **Alembic** - Database migration tool
- **WebSockets** - Real-time communication
- **Uvicorn** - ASGI server

### Frontend

- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first CSS framework

### Development Tools

- **Black** - Python code formatter
- **Ruff** - Fast Python linter
- **ESLint** - JavaScript/TypeScript linter
- **Prettier** - Code formatter
- **Docker** - Containerization

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose (optional)

### Option 1: Docker (Recommended)

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd fastchat-app
   ```

2. Start all services:

   ```bash
   docker-compose -f infra/docker-compose.yml up
   ```

3. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Option 2: Local Development

#### Database Setup (Neon)

1. Create a Neon database:

   - Go to [Neon Console](https://console.neon.tech/)
   - Sign up/Login and create a new project
   - Copy your connection string

2. Set up environment variables:
   ```bash
   cp env.example .env
   # Edit .env and add your Neon DATABASE_URL
   ```

#### Backend Setup

1. Create and activate virtual environment:

   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Run database migrations:

   ```bash
   cd backend
   alembic upgrade head
   ```

4. Run the backend:
   ```bash
   cd backend
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

#### Frontend Setup

1. Install dependencies:

   ```bash
   cd frontend
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

## Development

### Code Quality

- **Python**: Run `black .` to format code, `ruff check .` to lint
- **Frontend**: Run `npm run lint` to lint, `npm run format` to format

### Database Migrations

```bash
cd backend
alembic revision --autogenerate -m "Description"
alembic upgrade head
```

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /health/db` - Database connectivity check
- `GET /docs` - Interactive API documentation (Swagger UI)

## Project Structure

```
fastchat-app/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py         # FastAPI application
│   │   └── routers/        # API route handlers
│   └── Dockerfile
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── App.tsx         # Main app component
│   │   └── main.tsx        # Entry point
│   └── Dockerfile
├── infra/                  # Infrastructure
│   └── docker-compose.yml  # Docker services
├── .github/                # GitHub Actions
│   └── workflows/          # CI/CD pipelines
└── docs/                   # Documentation
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
