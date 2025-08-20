# FastChat Application Architecture

## System Overview

FastChat is a real-time chat application built with a modern microservices architecture using FastAPI, React, and PostgreSQL.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FastChat Application                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
│  │   Frontend      │    │    Backend      │    │      Database           │  │
│  │   (React)       │    │   (FastAPI)     │    │    (PostgreSQL)         │  │
│  │                 │    │                 │    │                         │  │
│  │ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────────────┐ │  │
│  │ │   React     │ │    │ │   FastAPI   │ │    │ │   Neon PostgreSQL   │ │  │
│  │ │ Components  │ │    │ │   Server    │ │    │ │   (Serverless)      │ │  │
│  │ │             │ │    │ │             │ │    │ │                     │ │  │
│  │ │ • ChatPane  │ │    │ │ • REST API  │ │    │ │ • users_online      │ │  │
│  │ │ • OnlineUsers│ │    │ │ • WebSocket│ │    │ │ • chat_messages     │ │  │
│  │ │ • Connection │ │    │ │ • Presence  │ │    │ │ • user_sessions     │ │  │
│  │ │   Banner     │ │    │ │   Service   │ │    │ │                     │ │  │
│  │ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────────────┘ │  │
│  │                 │    │                 │    │                         │  │
│  │ ┌─────────────┐ │    │ ┌─────────────┐ │    │                         │  │
│  │ │   Zustand   │ │    │ │   SQLAlchemy│ │    │                         │  │
│  │ │   Store     │ │    │ │   ORM       │ │    │                         │  │
│  │ │             │ │    │ │             │ │    │                         │  │
│  │ │ • Presence  │ │    │ │ • Models    │ │    │                         │  │
│  │ │ • Chat      │ │    │ │ • Migrations│ │    │                         │  │
│  │ │ • Identity  │ │    │ │ • Sessions  │ │    │                         │  │
│  │ └─────────────┘ │    │ └─────────────┘ │    │                         │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘  │
│           │                       │                       │                 │
│           │                       │                       │                 │
│           │ HTTP/HTTPS            │                       │                 │
│           │ REST API              │                       │                 │
│           │ (Port 8000)           │                       │                 │
│           │                       │                       │                 │
│           │ WebSocket             │                       │                 │
│           │ (Port 8000/ws)        │                       │                 │
│           │                       │                       │                 │
│           │                       │ PostgreSQL            │                 │
│           │                       │ Connection            │                 │
│           │                       │ (Neon)                │                 │
│           │                       │                       │                 │
└─────────────────────────────────────────────────────────────────────────────┘

## Component Details

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI)
- **State Management**: Zustand
- **Real-time**: WebSocket client
- **Styling**: Material-UI with custom theme

### Backend (FastAPI + Python)
- **Framework**: FastAPI
- **Server**: Uvicorn (ASGI)
- **Database**: SQLAlchemy ORM
- **Migrations**: Alembic
- **Real-time**: WebSocket support
- **Authentication**: JWT (planned)

### Database (PostgreSQL)
- **Provider**: Neon (serverless PostgreSQL)
- **Tables**: users_online, chat_messages, user_sessions
- **Features**: Automatic scaling, connection pooling

## Data Flow

### 1. User Authentication Flow
```

User → Frontend → Backend → Database
↓
Generate UUID + Random Name
↓
Store in localStorage
↓
Send HELLO via WebSocket

```

### 2. Presence Management Flow
```

Frontend → Heartbeat API → Database
↓
Update last_seen timestamp
↓
Background reaper cleans stale entries
↓
Broadcast presence updates via WebSocket

```

### 3. Chat Message Flow
```

User A → Frontend → WebSocket → Backend
↓
Validate message
↓
Store in database
↓
Forward to User B via WebSocket
↓
User B → Frontend → Display message

```

## Security Features

- **CORS**: Configurable allowed origins
- **Input Validation**: Message length limits
- **Rate Limiting**: Heartbeat intervals
- **SQL Injection Protection**: SQLAlchemy ORM
- **XSS Protection**: React sanitization

## Performance Optimizations

- **Database**: Connection pooling with Neon
- **Frontend**: Code splitting with Vite
- **Caching**: Static asset caching with nginx
- **Compression**: Gzip compression
- **Real-time**: Efficient WebSocket handling

## Deployment Architecture

```

┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Nginx │ │ FastAPI │ │ PostgreSQL │
│ (Frontend) │ │ (Backend) │ │ (Neon) │
│ │ │ │ │ │
│ • Static Files │ │ • REST API │ │ • Data Storage │
│ • API Proxy │ │ • WebSocket │ │ • Migrations │
│ • WebSocket │ │ • Business │ │ • Backups │
│ Proxy │ │ Logic │ │ │
└─────────────────┘ └─────────────────┘ └─────────────────┘

```

## Scalability Considerations

- **Horizontal Scaling**: Stateless backend services
- **Database**: Neon's automatic scaling
- **Caching**: Redis for session storage (future)
- **Load Balancing**: Multiple backend instances
- **CDN**: Static asset distribution (future)
```
