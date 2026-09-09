# AuctionSphere

[![CI — Tests](https://github.com/kavinmd/Auction/actions/workflows/ci.yml/badge.svg)](https://github.com/kavinmd/Auction/actions/workflows/ci.yml)

> **🔴 Live:** [auction-two-black.vercel.app](https://auction-two-black.vercel.app) &nbsp;|&nbsp; **Backend:** Render &nbsp;|&nbsp; **DB:** Neon PostgreSQL

A full-stack, real-time online auction platform with concurrency-safe bidding, live WebSocket updates, Stripe payments, and automated auction scheduling.

---

## ⚡ Key Engineering: Concurrency-Safe Bidding

The hardest problem in any auction system is **simultaneous bids**. AuctionSphere solves it with PostgreSQL row-level locking:

```python
# bid_service.py — every bid acquires an exclusive row lock
SELECT * FROM auctions WHERE id = ? FOR UPDATE;
-- Validates: status=open, now < end_time, amount > current_price
-- Then: INSERT bid + UPDATE current_price
-- COMMIT — lock released
```

**Result:** Two simultaneous bids on the same auction → exactly **one succeeds**, one gets a clear `400`. This is verified by an automated concurrency test using `asyncio.gather()`.

**Anti-sniping:** A bid placed in the last 60 seconds automatically extends the auction by 2 minutes.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (React 18 + Vite)                │
│  Axios (REST) ──────────────────────────────────────────┐   │
│  WebSocket (useAuctionSocket hook, auto-reconnect) ──┐  │   │
└─────────────────────────────────────────────────────────────┘
                                                         │  │
                    ┌────────────────────────────────────┘  │
                    │  FastAPI (Uvicorn, async)             │
                    │  ┌──────────────────────────┐        │
                    │  │  REST API Routes          │        │
                    │  │  /api/auth /api/auctions  │◄───────┘
                    │  │  /api/bids /api/payments  │
                    │  │  /api/watchlist /api/admin│
                    │  └──────────────────────────┘
                    │  ┌──────────────────────────┐
                    │  │  WebSocket               │
                    │  │  /ws/auctions/{id}        │
                    │  │  ConnectionManager        │
                    │  │  (dict: id → [WS, ...])  │
                    │  └──────────────────────────┘
                    │  ┌──────────────────────────┐
                    │  │  APScheduler (60s job)   │
                    │  │  Auto-closes auctions    │
                    │  │  Notifies winner/seller  │
                    │  └──────────────────────────┘
                    └────────────┬───────────────────
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
     PostgreSQL (Neon)    Cloudinary (images)  Stripe (payments)
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.11, FastAPI, Uvicorn |
| **ORM** | SQLAlchemy 2.0 (async) + asyncpg |
| **Auth** | JWT (python-jose) + bcrypt (passlib) |
| **Real-time** | WebSocket — native FastAPI/Starlette |
| **Scheduler** | APScheduler — auto-closes expired auctions |
| **Payments** | Stripe Checkout + webhook signature verification |
| **Images** | Cloudinary (stateless — only URL stored in DB) |
| **Database** | PostgreSQL 15 (Neon in prod, Docker locally) |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **Rate Limiting** | SlowAPI (10 bids/min per user) |
| **Security** | Security headers middleware, CORS locked to frontend domain |

---

## 🧪 Test Suite

```bash
cd server
pytest -v
```

| Test file | What it covers |
|-----------|---------------|
| `tests/test_auth.py` | Register, login, JWT, 401 on wrong password |
| `tests/test_bids.py` | **Concurrency test** — `asyncio.gather()` fires 2 simultaneous bids; asserts exactly 1 succeeds |
| `tests/test_scheduler.py` | Auction auto-close, winner notification in DB |
| `tests/test_payments.py` | Stripe webhook signature + `status=paid` transition |

---

## 🔑 Demo Credentials

You can try the live app at [auction-two-black.vercel.app](https://auction-two-black.vercel.app) or register a new account.

A seed user is available after running `python seed.py` locally:

| Field | Value |
|-------|-------|
| Email | `demo@auctionsphere.com` |
| Password | `Demo@1234` |

> For Stripe test payments use card `4242 4242 4242 4242`, any future date, any CVC.

---

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
# source venv/bin/activate   # macOS/Linux
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
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| pgAdmin | http://localhost:5050 |

---

## 🌐 Environment Variables

See [`server/.env.example`](server/.env.example) for the full list. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (asyncpg) |
| `JWT_SECRET_KEY` | Secret for signing JWTs |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `CLOUDINARY_*` | Image upload credentials |
| `FRONTEND_URL` | CORS allowed origin |

---

## 📐 Database Schema

```
users          auctions        bids
──────         ────────        ────
id (UUID) ◄─── seller_id       id (UUID)
name           title           auction_id ──► auctions
email          description     bidder_id  ──► users
password_hash  category        amount
is_admin       image_urls[]    created_at
               starting_price
               current_price   payments        notifications
               end_time        ────────        ─────────────
               status (enum)   id (UUID)       id (UUID)
               created_at      auction_id      user_id ──► users
                               winner_id       message
watchlist                      stripe_id       is_read
─────────                      amount          created_at
user_id ──► users              status (enum)
auction_id ──► auctions
```
