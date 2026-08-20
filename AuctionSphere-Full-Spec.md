# AuctionSphere — Full Project Specification
### (Hand this file to your AI coding assistant / Claude Code to start building from scratch)

---

## 1. Project Overview

**Name:** AuctionSphere
**Type:** Real-time online auction platform (full-stack web application)
**Purpose:** A production-style auction system where sellers list items and buyers place competing bids in real time until a countdown timer expires, at which point the highest bidder wins and completes payment.

**Primary technical challenge to solve:** Preventing race conditions when multiple users bid on the same item simultaneously, using database transactions and row-level locking — not just simple "highest number wins" logic without concurrency control.

**Target developer profile:** Solo full-stack developer, ~1 year experience, comfortable in Python/FastAPI and React/TypeScript.

---

## 2. Tech Stack (exact versions/tools to use)

### Backend
- Python 3.11+
- FastAPI (web framework)
- Uvicorn (ASGI server)
- SQLAlchemy 2.0 (async ORM)
- asyncpg (PostgreSQL async driver)
- Alembic (database migrations)
- python-jose (JWT handling)
- passlib[bcrypt] (password hashing)
- APScheduler (scheduled background jobs)
- stripe (Python SDK for payments)
- websockets (built into FastAPI/Starlette)
- pydantic v2 (request/response validation)
- pytest + pytest-asyncio + httpx (testing)

### Frontend
- React 18
- TypeScript
- Vite (build tool)
- Tailwind CSS
- React Router DOM v6
- Axios (HTTP client)
- react-hot-toast (notifications)
- native WebSocket API (or a small wrapper hook)

### Database
- PostgreSQL 15+ (local via Docker, or hosted free tier on Neon/Supabase)

### Infrastructure / third-party
- Cloudinary (image uploads for auction items)
- Stripe (test mode — payments)
- Deployment targets: Vercel (frontend), Render or Railway (backend), Neon or Supabase (database)

---

## 3. User Roles

1. **Bidder** — browses auctions, places bids, tracks watchlist and bid history, pays when they win
2. **Seller** — creates and manages auction listings, views bids on their items, marks items shipped after sale
3. **Admin** (lightweight) — can view/remove any listing, view all users

A single user account can act as both bidder and seller (no separate signup flows needed — just role flags or unrestricted access to both feature sets).

---

## 4. Full Feature List

### Authentication
- Register (email, password, name)
- Login (returns JWT)
- Get current user (`/me`)
- Password hashing with bcrypt
- JWT-protected routes (dependency injection in FastAPI)

### Auctions
- Create auction listing: title, description, category, starting price, image(s), end time
- Edit/delete own listing (only if no bids placed yet, or only before auction starts — define this rule)
- List all open auctions with pagination
- Filter/search by category, price range, keyword, "ending soon"
- View single auction detail: current price, time remaining, seller info, full bid history

### Bidding (core feature)
- Place a bid on an open auction
- Validation rules:
  - Bid amount must be strictly greater than current highest bid (or starting price if no bids yet)
  - Auction must be currently open (not closed/expired)
  - Seller cannot bid on their own auction
  - User must be authenticated
- **Concurrency control:** bid placement must run inside a database transaction using row-level locking (`SELECT ... FOR UPDATE` on the auction row) so that two simultaneous bid requests cannot both be validated against a stale "current price" and both succeed
- Real-time broadcast: the moment a valid bid is placed, all users currently viewing that auction receive the update instantly via WebSocket (no polling, no refresh)
- Anti-sniping rule: if a valid bid is placed within the final 30–60 seconds of the auction, extend the end time by 1–2 minutes, and broadcast the new end time to all connected clients

### Auction Lifecycle
- Background scheduled job (runs every 60 seconds) checks for auctions whose end_time has passed
- Automatically marks expired auctions as `closed`
- Determines the winner (highest valid bid, or no winner if zero bids)
- Broadcasts an "auction closed" event over WebSocket to anyone still watching
- Triggers notification to winner and seller

### Notifications
- In-app notification records: "You've been outbid," "You won [item]," "Your item sold," "Payment received"
- Simple notification list/dropdown in the UI, mark-as-read

### Payments
- Winning bidder is directed to a Stripe Checkout session for the winning amount
- Stripe webhook endpoint receives payment confirmation and updates the `payments` table + auction status to `paid`
- Handle failed/cancelled payments gracefully (auction can optionally reopen to next-highest bidder — decide and document this rule)

### Dashboards
- Buyer dashboard: My Bids, My Watchlist, Won Auctions (with payment status)
- Seller dashboard: My Listings (with live bid count and current price), Sold Items, mark item as Shipped
- Watchlist: save/unsave auctions to check later

### Admin
- View all users and all auctions
- Remove/flag inappropriate listings

### Non-functional requirements
- Rate limiting on the bid endpoint (prevent spam/abuse)
- Input validation on all endpoints via Pydantic schemas
- CORS properly configured for frontend origin
- No secrets committed to the repo — all via environment variables
- Basic automated tests covering: auth flow, bid concurrency logic, payment webhook handling
- Mobile-responsive frontend

---

## 5. Database Schema

```
users
- id (PK, UUID)
- name (string)
- email (string, unique)
- password_hash (string)
- created_at (timestamp)

auctions
- id (PK, UUID)
- seller_id (FK -> users.id)
- title (string)
- description (text)
- category (string)
- image_urls (array/string list)
- starting_price (decimal)
- current_price (decimal)
- end_time (timestamp)
- status (enum: open, closed, paid, cancelled)
- created_at (timestamp)

bids
- id (PK, UUID)
- auction_id (FK -> auctions.id)
- bidder_id (FK -> users.id)
- amount (decimal)
- created_at (timestamp)

payments
- id (PK, UUID)
- auction_id (FK -> auctions.id)
- winner_id (FK -> users.id)
- stripe_payment_id (string)
- amount (decimal)
- status (enum: pending, succeeded, failed)
- created_at (timestamp)

watchlist
- user_id (FK -> users.id)
- auction_id (FK -> auctions.id)
- (composite PK on user_id + auction_id)

notifications
- id (PK, UUID)
- user_id (FK -> users.id)
- message (string)
- is_read (boolean, default false)
- created_at (timestamp)
```

Relationships:
- One user → many auctions (as seller)
- One user → many bids (as bidder)
- One auction → many bids
- One auction → one payment (once sold)
- Many-to-many: users ↔ auctions via watchlist

---

## 6. API Endpoints (REST + WebSocket)

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login, returns JWT |
| GET | /api/auth/me | Get current authenticated user |

### Auctions
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auctions | Create auction (auth required) |
| GET | /api/auctions | List auctions (pagination, filters) |
| GET | /api/auctions/{id} | Get auction detail |
| PUT | /api/auctions/{id} | Update auction (owner only) |
| DELETE | /api/auctions/{id} | Delete auction (owner only) |

### Bids
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auctions/{id}/bids | Place a bid |
| GET | /api/auctions/{id}/bids | Get bid history for an auction |
| GET | /api/users/me/bids | Get current user's bid history |

### Watchlist
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/watchlist/{auction_id} | Add to watchlist |
| DELETE | /api/watchlist/{auction_id} | Remove from watchlist |
| GET | /api/users/me/watchlist | Get current user's watchlist |

### Payments
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/payments/checkout/{auction_id} | Create Stripe checkout session |
| POST | /api/payments/webhook | Stripe webhook receiver |

### Notifications
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/users/me/notifications | List notifications |
| PUT | /api/notifications/{id}/read | Mark as read |

### WebSocket
| Endpoint | Description |
|---|---|
| /ws/auctions/{id} | Real-time bid updates, auction extension events, auction-closed events for a specific auction room |

---

## 7. Suggested Folder Structure

```
AuctionSphere/
├── server/
│   ├── app/
│   │   ├── main.py                 # FastAPI app entrypoint
│   │   ├── config.py                # env/settings
│   │   ├── database.py              # SQLAlchemy async engine/session
│   │   ├── models/                  # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── auction.py
│   │   │   ├── bid.py
│   │   │   ├── payment.py
│   │   │   ├── watchlist.py
│   │   │   └── notification.py
│   │   ├── schemas/                 # Pydantic request/response models
│   │   ├── routes/                  # API route handlers
│   │   │   ├── auth.py
│   │   │   ├── auctions.py
│   │   │   ├── bids.py
│   │   │   ├── payments.py
│   │   │   ├── watchlist.py
│   │   │   └── notifications.py
│   │   ├── services/                 # Business logic (bid validation, locking, payment logic)
│   │   ├── websocket/
│   │   │   ├── connection_manager.py
│   │   │   └── auction_socket.py
│   │   ├── jobs/
│   │   │   └── auction_scheduler.py  # APScheduler auto-close job
│   │   ├── auth/
│   │   │   ├── jwt_handler.py
│   │   │   └── dependencies.py
│   │   └── middleware/
│   ├── alembic/                      # migrations
│   ├── tests/
│   ├── requirements.txt
│   └── .env
│
├── client/
│   ├── src/
│   │   ├── api/                      # axios wrapper functions per resource
│   │   ├── components/               # shared UI components
│   │   ├── context/                  # AuthContext
│   │   ├── hooks/
│   │   │   └── useAuctionSocket.ts   # WebSocket hook
│   │   ├── pages/
│   │   │   ├── Login.tsx / Register.tsx
│   │   │   ├── AuctionList.tsx
│   │   │   ├── AuctionDetail.tsx
│   │   │   ├── CreateAuction.tsx
│   │   │   ├── BuyerDashboard.tsx
│   │   │   ├── SellerDashboard.tsx
│   │   │   └── AdminDashboard.tsx
│   │   ├── routes/                   # protected route guards
│   │   ├── types/                    # TypeScript interfaces
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── docs/
│   ├── er-diagram.png
│   └── design-decisions.md
│
├── README.md
└── docker-compose.yml (optional, for local Postgres)
```

---

## 8. Key Design Decisions to Implement Correctly

1. **Bid concurrency:** Every bid placement must be wrapped in a single DB transaction. Lock the auction row (`SELECT ... FOR UPDATE`) before reading the current price, validate the new bid against that locked value, insert the bid, update `current_price`, then commit. This guarantees only one of two simultaneous requests can win.
2. **WebSocket broadcasting:** Maintain a connection manager (in-memory dict of `auction_id -> list of active WebSocket connections`) so a new bid can be pushed to every client currently viewing that specific auction, not all connected clients globally.
3. **Scheduled job idempotency:** The auto-close job must not double-process an auction already marked `closed` — check status before acting.
4. **Stripe webhook verification:** Verify the Stripe signature on incoming webhooks before trusting the payload (security requirement, not optional).
5. **JWT expiry + refresh:** Decide and implement a reasonable token expiry (e.g., 7 days) with clear 401 handling on the frontend when expired.

---

## 9. Instructions for the AI Assistant Building This

When implementing this project:
- Build backend and frontend in parallel but get one full vertical slice working first (auth → create auction → place bid → see it update) before adding payments/notifications/admin.
- Prioritize correctness of the concurrency-safe bidding logic above all other features — this is the centerpiece of the project.
- Use async/await consistently throughout the FastAPI backend (async SQLAlchemy sessions, async route handlers).
- Keep business logic out of route handlers — put it in a `services/` layer so it's testable independently of HTTP.
- Write the README as you go, not at the end — include the "why PostgreSQL + row locking" reasoning explicitly, since this is the project's main technical story.
- Use environment variables for all secrets (DB URL, JWT secret, Stripe keys, Cloudinary keys) — never hardcode.
- Follow the folder structure above so the codebase mirrors a real production FastAPI + React project layout.

---

## 10. Definition of Done

The project is considered complete and interview-ready when:
- A user can register, log in, create an auction, and another user can bid on it in real time with live updates visible to both without refreshing
- Two simultaneous bid requests on the same auction are provably handled correctly (one succeeds, one is rejected with a clear error)
- An auction automatically closes at its end time and determines a winner without manual intervention
- The winner can complete a Stripe test payment and the status updates accordingly
- The app is deployed and publicly accessible via a live URL
- The README explains the architecture, schema, and the concurrency-handling design decision clearly enough for someone else to understand without reading the code
