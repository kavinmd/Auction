# AuctionSphere

A real-time online auction platform built with **FastAPI + PostgreSQL + React 18 + TypeScript**.

## 🏗️ Architecture

```
AuctionSphere/
├── server/    → Python/FastAPI backend (REST + WebSocket)
├── client/    → React 18 + TypeScript frontend (Vite)
└── docs/      → Design decisions, ER diagram
```

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.11+, Uvicorn |
| ORM | SQLAlchemy 2.0 (async) + asyncpg |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Real-time | WebSocket (native FastAPI/Starlette) |
| Scheduler | APScheduler |
| Payments | Stripe (test mode) |
| Images | Cloudinary |
| Database | PostgreSQL 15 |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |

## ⚡ Key Design Decision: Concurrency-Safe Bidding

Every bid placement is wrapped in a PostgreSQL transaction with row-level locking (`SELECT ... FOR UPDATE`). This guarantees that two simultaneous bid requests cannot both read a stale "current price" and both succeed — only one wins, the other is rejected with a clear error.

## 🚀 Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker Desktop

### 1. Start the database
```bash
docker-compose up -d
```

### 2. Backend
```bash
cd server
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env          # fill in your values
alembic upgrade head
uvicorn app.main:app --reload
```

### 3. Frontend
```bash
cd client
npm install
npm run dev
```

### 4. URLs
| Service | URL |
|---|---|
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Frontend | http://localhost:5173 |
| pgAdmin | http://localhost:5050 |

## 🌐 Environment Variables

See `.env.example` for the full list of required environment variables.

## 📋 Live URL

> Coming soon after deployment on Day 15.
