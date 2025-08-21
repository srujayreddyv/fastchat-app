# FastChat 💬⚡

A real-time 1:1 chat app built with **FastAPI**, **PostgreSQL**, and **React**.  
Supports online presence, WebSocket messaging, and graceful disconnects — all with zero authentication or chat history.

## ✨ Features

- **💬 Real-time messaging** via WebSocket
- **👥 Live presence tracking** (who's online)
- **⌨️ Typing indicators** and message status
- **🎨 Professional UI** with Material-UI
- **🔄 Auto-reconnection** with exponential backoff
- **📱 Responsive design** for all devices
- **🛡️ Rate limiting** protection against spam
- **📊 Real-time metrics** and performance monitoring
- **🧪 Comprehensive testing** with pytest
- **🚀 CI/CD pipeline** with GitHub Actions
- **🐳 Production-ready** Docker deployment

## 🎯 Quick Demo

<div align="center">

**🚀 Try it now!** Open multiple browser tabs to test real-time chat:

```bash
# Start the app
make up

# Open in browser
open http://localhost:3000
```

</div>

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│   (React)       │    │   (FastAPI)     │    │ (PostgreSQL)    │
│                 │    │                 │    │                 │
│ • ChatPane      │    │ • REST API      │    │ • users_online  │
│ • OnlineUsers   │    │ • WebSocket     │    │ • chat_messages │
│ • Material-UI   │    │ • Presence      │    │ • user_sessions │
│ • Zustand Store │    │ • SQLAlchemy    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

📖 **[Full Architecture Documentation](docs/chat_app_architecture.md)**

## 🛠️ Tech Stack

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
- **Material-UI** - Professional UI components
- **Zustand** - State management

### Development Tools

- **Black** - Python code formatter
- **Ruff** - Fast Python linter
- **ESLint** - JavaScript/TypeScript linter
- **Prettier** - Code formatter
- **Docker** - Containerization
- **Pytest** - Testing framework
- **GitHub Actions** - CI/CD automation

## 🚀 Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- PostgreSQL (Neon recommended)
- Docker & Docker Compose

### ⚡ Quick Start (5 minutes)

1. **Clone and setup**

   ```bash
   git clone <repository-url>
   cd fastchat-app
   cp env.example .env
   # Edit .env with your DATABASE_URL
   ```

2. **Start with Docker**

   ```bash
   make up
   ```

3. **Open in browser**

   - Frontend: http://localhost:3000
   - API Docs: http://localhost:8000/docs

4. **Test the app**
   ```bash
   python scripts/manual_test.py
   ```

### Option 1: Docker (Recommended)

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd fastchat-app
   ```

2. Set up environment variables:

   ```bash
   cp env.example .env
   # Edit .env with your DATABASE_URL and other settings
   ```

3. Start all services:

   ```bash
   make up
   ```

4. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Docker Commands

The project includes a comprehensive Makefile for easy Docker operations:

```bash
# Start services
make up

# Stop services
make down

# View logs
make logs
make logs-backend
make logs-frontend

# Build images
make build
make build-backend
make build-frontend

# Database operations
make migrate
make migrate-up
make migrate-down

# Testing
make test
make test-frontend
make lint

# Maintenance
make clean
make prune
make shell-backend
make shell-frontend

# Status
make status
make health

# Show all available commands
make help
```

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

### Running Tests

```bash
# Backend tests
cd backend
pytest tests/ -v --cov=app --cov-report=html

# Run specific test categories
pytest tests/test_api.py -v          # API endpoint tests
pytest tests/test_websocket.py -v    # WebSocket integration tests
pytest tests/test_rate_limiting.py -v # Rate limiting tests
pytest tests/test_metrics.py -v      # Metrics collection tests

# Frontend tests
cd frontend
npm test
```

### Code Quality

- **Python**: Run `black .` to format code, `ruff check .` to lint
- **Frontend**: Run `npm run lint` to lint, `npm run format` to format

### Quality & Resilience Features

#### Rate Limiting

- **Message Rate**: 60 messages per minute per user
- **Typing Indicators**: 10 per minute per user
- **Ping Messages**: 30 per minute per user
- **Automatic Cleanup**: Old timestamps cleaned every 5 minutes

#### Metrics Collection

- **Connection Tracking**: Total, active, and peak connections
- **Message Analytics**: Counts by type and processing times
- **Error Monitoring**: Error rates and types
- **Performance Metrics**: Messages per second, connections per minute
- **Time-based Stats**: Hourly and daily aggregations

#### Testing Coverage

- **Unit Tests**: API endpoints, WebSocket handlers, rate limiting
- **Integration Tests**: WebSocket communication, message flow
- **Mock Testing**: Isolated component testing with mock WebSockets
- **Coverage Reporting**: HTML coverage reports with pytest-cov

### Database Migrations

```bash
cd backend
alembic revision --autogenerate -m "Description"
alembic upgrade head
```

## API Documentation

### REST Endpoints

| Endpoint                   | Method | Description                   |
| -------------------------- | ------ | ----------------------------- |
| `GET /health`              | GET    | Health check endpoint         |
| `GET /health/db`           | GET    | Database connectivity check   |
| `POST /presence/heartbeat` | POST   | Update user presence          |
| `GET /presence/online`     | GET    | Get online users list         |
| `GET /metrics/`            | GET    | Application metrics           |
| `GET /metrics/user/{id}`   | GET    | User-specific metrics         |
| `GET /metrics/hourly`      | GET    | Hourly statistics             |
| `GET /metrics/daily`       | GET    | Daily statistics              |
| `GET /docs`                | GET    | Interactive API documentation |

### WebSocket Protocol

FastChat uses WebSocket for real-time communication:

- **Connection**: `ws://localhost:8000/ws`
- **Message Format**: JSON
- **Protocol**: [WebSocket Protocol Documentation](docs/websocket_protocol.md)

#### Key Message Types:

- `HELLO` - Establish user identity
- `MSG` - Send/receive chat messages
- `TYPING` - Typing indicators
- `PRESENCE` - Online users updates
- `ERROR` - Error handling

### Example Usage

```bash
# Test API endpoints
curl http://localhost:8000/health
curl http://localhost:8000/presence/online

# Test WebSocket (using wscat)
wscat -c ws://localhost:8000/ws
{"type":"HELLO","data":{"user_id":"test-123","display_name":"Test User"}}
```

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

## Known Limitations

### Current Limitations

- **No persistent authentication** - Users are identified by UUID only
- **No message history** - Messages are not stored in database
- **No file sharing** - Text messages only
- **No group chats** - 1:1 conversations only
- **No message encryption** - Messages are not end-to-end encrypted
- **No offline support** - Requires active connection

### Planned Features

- [ ] User authentication with JWT
- [ ] Message persistence and history
- [ ] File and image sharing
- [ ] Group chat support
- [ ] Message encryption
- [ ] Offline message queuing
- [ ] Push notifications
- [ ] User profiles and avatars

### Technical Debt

- ✅ WebSocket error handling improved with comprehensive error recovery
- ✅ UUID serialization issues resolved in backend
- ✅ Comprehensive test coverage implemented (37 tests passing)
- ✅ Rate limiting implementation completed
- ✅ Robust error recovery mechanisms in place

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`make lint`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

- Follow the existing code style (Black for Python, Prettier for JS/TS)
- Add tests for new features
- Update documentation for API changes
- Ensure Docker builds work correctly

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
