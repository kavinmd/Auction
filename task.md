# AuctionSphere � 15-Day Build Plan
> **Start Date:** Day 1 | **Deadline:** Day 15
> **Stack:** FastAPI + PostgreSQL + React 18 + TypeScript + Tailwind CSS
> **Goal:** Fully functional, deployed, interview-ready auction platform

---

## ?? Day 1 � Project Setup & Scaffolding
> **Theme:** Get the skeleton running locally end-to-end

- `[ ]` **1.1** Create monorepo root `AuctionSphere/` with `README.md` and `.gitignore`
- `[ ]` **1.2** Write `docker-compose.yml` for local PostgreSQL 15 + pgAdmin
- `[ ]` **1.3** Scaffold `server/` � FastAPI project with all folders: `app/models/`, `app/schemas/`, `app/routes/`, `app/services/`, `app/auth/`, `app/websocket/`, `app/jobs/`, `app/middleware/`
- `[ ]` **1.4** Create `requirements.txt` with all backend dependencies and install them
- `[ ]` **1.5** Set up `app/config.py` � load all env vars via Pydantic `BaseSettings`
- `[ ]` **1.6** Set up `app/database.py` � async SQLAlchemy engine + session using `asyncpg`
- `[ ]` **1.7** Configure CORS middleware in `app/main.py`
- `[ ]` **1.8** Scaffold `client/` � `npm create vite@latest` (React + TypeScript)
- `[ ]` **1.9** Install frontend deps: Tailwind CSS, React Router v6, Axios, react-hot-toast
- `[ ]` **1.10** Set up Alembic (`alembic init`, connect to async engine, configure `env.py`)
- `[ ]` **1.11** Create `.env` and `.env.example` � DB URL, JWT secret, Stripe, Cloudinary keys

**? Day 1 Goal:** `uvicorn app.main:app` starts without errors; Vite dev server runs; Docker Postgres is reachable

---

## ?? Day 2 � Database Models & Migrations
> **Theme:** Define every table, run migrations, verify schema in DB

- `[x]` **2.1** Create `models/user.py` � UUID PK, name, email (unique), password_hash, is_admin (bool), created_at
- `[x]` **2.2** Create `models/auction.py` � UUID PK, seller_id FK, title, description, category, image_urls (ARRAY), starting_price, current_price, end_time, status (Enum: open/closed/paid/cancelled), created_at
- `[x]` **2.3** Create `models/bid.py` � UUID PK, auction_id FK, bidder_id FK, amount (Decimal), created_at
- `[x]` **2.4** Create `models/payment.py` � UUID PK, auction_id FK, winner_id FK, stripe_payment_id, amount, status (Enum: pending/succeeded/failed), created_at
- `[x]` **2.5** Create `models/watchlist.py` � composite PK (user_id + auction_id), both FKs
- `[x]` **2.6** Create `models/notification.py` � UUID PK, user_id FK, message, is_read (bool default false), created_at
- `[x]` **2.7** Register all models in `app/main.py` imports
- `[x]` **2.8** Generate Alembic migration: `alembic revision --autogenerate -m "initial schema"`
- `[x]` **2.9** Run migration: `alembic upgrade head` � verify all 6 tables in PostgreSQL

**? Day 2 Goal:** All tables exist in DB with correct columns, types, constraints, and foreign keys

---

## ?? Day 3  Authentication (Backend)
> **Theme:** Secure register/login with JWT  the foundation for every protected route

- `[x]` **3.1** Create `schemas/user.py`  `UserCreate`, `UserLogin`, `UserOut` Pydantic models
- `[x]` **3.2** Create `auth/jwt_handler.py`  `create_access_token()` (HS256, 7-day expiry), `decode_access_token()`
- `[x]` **3.3** Create `auth/dependencies.py`  `get_current_user` FastAPI dependency: extract Bearer token, decode JWT, fetch user, raise 401 if invalid/expired
- `[x]` **3.4** Create `services/auth_service.py`  `register_user()` (bcrypt hash, insert user), `authenticate_user()` (verify hash, return user)
- `[x]` **3.5** Create `routes/auth.py`  `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `[x]` **3.6** Mount auth router in `main.py`
- `[x]` **3.7** Test with Postman: register ? login ? `/me` returns correct user data

**? Day 3 Goal:** Auth endpoints work; JWT verified on protected routes; wrong password returns 401

---

## ?? Day 4  Authentication (Frontend)
> **Theme:** Login/register UI wired to backend; session persists on refresh

- `[x]` **4.1** Create `src/api/auth.ts`  Axios functions: `register()`, `login()`, `getMe()`
- `[x]` **4.2** Create `src/context/AuthContext.tsx`  stores user + token; loads from localStorage on mount; exposes `login()`, `logout()`, `register()`
- `[x]` **4.3** Create `src/components/ProtectedRoute.tsx`  redirects to `/login` if no valid token
- `[x]` **4.4** Build `src/pages/Register.tsx`  name, email, password fields; success ? auto-login; error toast on failure
- `[x]` **4.5** Build `src/pages/Login.tsx`  email + password; success ? redirect to home; error toast
- `[x]` **4.6** Create `src/components/Navbar.tsx`  shows user name + logout when logged in; Login/Register links when not
- `[x]` **4.7** Set up `src/App.tsx` with React Router routes: `/`, `/login`, `/register`
- `[x]` **4.8** Add global Axios interceptor  attaches JWT header; on 401 ? clear token + redirect to login

**? Day 4 Goal:** Can register, login, refresh page and stay logged in, logout clears session

---

## ?? Day 5 � Auction CRUD (Backend)
> **Theme:** Create, list, view, edit, delete auctions with Cloudinary image uploads

- `[x]` **5.1** Set up Cloudinary SDK � `services/cloudinary_service.py` with `upload_image(file)` function
- `[x]` **5.2** Create `schemas/auction.py` � `AuctionCreate`, `AuctionUpdate`, `AuctionOut`, `AuctionListOut`
- `[x]` **5.3** Create `services/auction_service.py` � `create_auction()`, `get_auction()`, `list_auctions()` (filter by category, keyword, price range, ending-soon; paginate), `update_auction()`, `delete_auction()` (guard: no bids placed)
- `[x]` **5.4** Create `routes/auctions.py` � `POST /api/auctions`, `GET /api/auctions`, `GET /api/auctions/{id}`, `PUT /api/auctions/{id}`, `DELETE /api/auctions/{id}`
- `[x]` **5.5** Mount auctions router in `main.py`
- `[x]` **5.6** Test: create auction with image ? Cloudinary URL stored in DB; filters return correct results

**? Day 5 Goal:** Full auction CRUD works; images upload to Cloudinary; pagination and filters function correctly

---

## ?? Day 6  Auction CRUD (Frontend)
> **Theme:** Browse and create auctions in a polished UI

- `[x]` **6.1** Create `src/api/auctions.ts` – Axios wrappers for all auction endpoints
- `[x]` **6.2** Create `src/types/index.ts` – TypeScript interfaces: `Auction`, `Bid`, `User`, `Notification`, `Payment`
- `[x]` **6.3** Build `src/components/AuctionCard.tsx` – reusable card (image, title, current price, time remaining badge, category)
- `[x]` **6.4** Build `src/pages/AuctionList.tsx` – responsive grid of `AuctionCard`, filter bar (category, price range, keyword, ending-soon toggle), pagination
- `[x]` **6.5** Build `src/pages/AuctionDetail.tsx` – images, title, description, current price (large), live countdown timer (`setInterval`), seller info, bid history table, bid form (visible only when open + not seller)
- `[x]` **6.6** Build `src/pages/CreateAuction.tsx` – form with title, description, category, starting price, end datetime, multi-image upload with preview; submit → redirect to new auction

**? Day 6 Goal:** Can browse with filters, view auction detail with live countdown, create a new listing with images

---

## ?? Day 7  Bidding Logic (Backend) ? CRITICAL
> **Theme:** Concurrency-safe bid placement with PostgreSQL row-level locking

- `[x]` **7.1** Create `schemas/bid.py` – `BidCreate` (amount: Decimal), `BidOut`
- `[x]` **7.2** Create `services/bid_service.py` – `place_bid(db, auction_id, bidder_id, amount)`:
  - Open transaction with row-level lock: `SELECT * FROM auctions WHERE id=? FOR UPDATE`
  - Validate inside lock: status == 'open', now < end_time, bidder != seller, amount > current_price
  - Insert new bid row; update `auction.current_price = amount`
  - Anti-sniping: if `end_time - now < 60s` → `end_time += 2 minutes`
  - Commit and return result
- `[x]` **7.3** Create `routes/bids.py` – `POST /api/auctions/{id}/bids` (auth), `GET /api/auctions/{id}/bids` (public), `GET /api/users/me/bids` (auth)
- `[x]` **7.4** Add rate limiting to bid endpoint using `slowapi` (max 10 bids/min per user)
- `[x]` **7.5** Write `tests/test_bids.py` concurrency test – `asyncio.gather()` fires 2 simultaneous bids; assert exactly 1 succeeds + 1 fails + DB has 1 bid row
- `[x]` **7.6** Run test – confirm it passes ✅

**? Day 7 Goal:** Bidding is concurrency-safe. Two simultaneous bids ? exactly one wins. Anti-sniping works.

---

## ?? Day 8  WebSocket Real-time Updates
> **Theme:** Instant live updates  no polling, no refresh needed

- `[x]` **8.1** Create `websocket/connection_manager.py` – `dict[auction_id → list[WebSocket]]`; `connect()`, `disconnect()`, `broadcast(auction_id, message)` methods
- `[x]` **8.2** Create `websocket/auction_socket.py` – endpoint `/ws/auctions/{id}`; accept, register, keep alive loop, deregister on disconnect
- `[x]` **8.3** Wire `bid_service.place_bid()` → after commit: `manager.broadcast(auction_id, { type: "new_bid", bidder_name, amount, current_price, end_time })`
- `[x]` **8.4** Wire scheduler → on auction close: `manager.broadcast(auction_id, { type: "auction_closed", winner_id, final_price })`
- `[x]` **8.5** Create `src/hooks/useAuctionSocket.ts` – opens WS on mount, parses JSON messages, calls `onNewBid` / `onAuctionClosed` / `onTimeExtended` callbacks, auto-reconnects with backoff
- `[x]` **8.6** Wire `AuctionDetail.tsx` to `useAuctionSocket` – `onNewBid` updates price + bid list; `onTimeExtended` updates countdown; `onAuctionClosed` shows banner + disables bid form
- `[x]` **8.7** Test: two browser tabs on same auction – bid in tab 1 → tab 2 updates instantly

**? Day 8 Goal:** Real-time updates work across multiple users with no page refresh

---

## ?? Day 9  Scheduler & Notifications (Backend)
> **Theme:** Auctions auto-close on schedule; users notified of key events

- `[x]` **9.1** Create `services/notification_service.py`  `create_notification(db, user_id, message)` helper
- `[x]` **9.2** Wire outbid notification in `bid_service.place_bid()`  after successful bid, notify previous highest bidder: "You've been outbid on [title]"
- `[x]` **9.3** Create `jobs/auction_scheduler.py`  APScheduler async job every 60s:
  - Query: `WHERE end_time <= now AND status = 'open'`
  - For each: `status = 'closed'`; find winner (highest bid); notify winner "You won!"; notify seller "Your item sold"; broadcast `auction_closed` WS event
  - Idempotency: skip any auction not in `open` status
- `[x]` **9.4** Register scheduler in `main.py` startup/shutdown lifecycle hooks
- `[x]` **9.5** Create `schemas/notification.py`  `NotificationOut`
- `[x]` **9.6** Create `routes/notifications.py`  `GET /api/users/me/notifications`, `PUT /api/notifications/{id}/read`
- `[x]` **9.7** Test: auction with `end_time = now + 65s` ? wait ? verify `status='closed'` and winner notification in DB

**? Day 9 Goal:** Auctions auto-close on time; winner/seller notified; notifications stored in DB

---

## ?? Day 10  Notifications (Frontend) & Payments (Backend)
> **Theme:** Notification bell UI + Stripe checkout flow

### Notifications Frontend
- `[ ]` **10.1** Create `src/api/notifications.ts` � fetch + mark-as-read functions
- `[ ]` **10.2** Add notification bell to `Navbar.tsx` � unread count badge, dropdown list on click, mark as read on click, poll every 30s

### Payments Backend
- `[ ]` **10.3** Set up Stripe test keys in `.env` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
- `[ ]` **10.4** Create `services/payment_service.py` � `create_checkout_session()`: verify user is winner + auction is closed + not paid ? create Stripe Checkout ? insert `payments` row with `status=pending`
- `[ ]` **10.5** Create `routes/payments.py`:
  - `POST /api/payments/checkout/{auction_id}` (auth, winner only) ? returns `{ checkout_url }`
  - `POST /api/payments/webhook` � verify Stripe signature; `checkout.session.completed` ? `status=succeeded`, `auction.status=paid`; `payment_intent.payment_failed` ? `status=failed`
- `[ ]` **10.6** Add failed-payment rule to `docs/design-decisions.md` � "No auto-reopen. Winner has 48h to retry. After that, seller must relist."
- `[ ]` **10.7** Test webhook locally via Stripe CLI: `stripe listen --forward-to localhost:8000/api/payments/webhook`

**? Day 10 Goal:** Notification bell shows live notifications; Stripe checkout created; webhook updates DB correctly

---

## ?? Day 11 � Payments (Frontend) & Dashboards
> **Theme:** Complete payment flow + buyer and seller dashboards

### Payments Frontend
- `[ ]` **11.1** Add "Pay Now" button in `BuyerDashboard` ? calls checkout API ? redirects to Stripe page
- `[ ]` **11.2** Create `src/pages/PaymentSuccess.tsx` � success page with order summary
- `[ ]` **11.3** Create `src/pages/PaymentCancel.tsx` � failed/cancelled page with retry link

### Buyer Dashboard
- `[ ]` **11.4** Build `src/pages/BuyerDashboard.tsx` with 3 tabs:
  - **My Bids** � all bids with auction title, amount, status, "winning" badge
  - **My Watchlist** � saved auctions with current price + time remaining
  - **Won Auctions** � won auctions with payment status (Pending/Paid) + Pay Now button

### Seller Dashboard
- `[ ]` **11.5** Build `src/pages/SellerDashboard.tsx` with 2 tabs:
  - **My Listings** � live bid count + current price; Edit/Delete if no bids; status badge
  - **Sold Items** � closed/paid auctions; "Mark as Shipped" button
- `[ ]` **11.6** Backend: `PUT /api/auctions/{id}/shipped` � seller marks item as shipped

### Watchlist
- `[ ]` **11.7** Create `src/api/watchlist.ts` � add/remove/fetch watchlist
- `[ ]` **11.8** Add heart toggle ?? to `AuctionCard.tsx` and `AuctionDetail.tsx`

**? Day 11 Goal:** Stripe payment completes and updates `auction.status=paid`; both dashboards are fully functional

---

## ?? Day 12 � Admin Panel & Watchlist Backend
> **Theme:** Admin oversight tools + complete watchlist API

### Watchlist Backend
- `[ ]` **12.1** Create `routes/watchlist.py` � `POST /api/watchlist/{id}`, `DELETE /api/watchlist/{id}`, `GET /api/users/me/watchlist`
- `[ ]` **12.2** Add upsert guard � duplicate watchlist entry returns 200 (not 409)

### Admin Panel
- `[ ]` **12.3** Add `is_admin` boolean to `users` model + Alembic migration
- `[ ]` **12.4** Create `auth/admin_dependency.py` � `require_admin` FastAPI dependency
- `[ ]` **12.5** Admin routes (all require `require_admin`):
  - `GET /api/admin/users` � all users list
  - `GET /api/admin/auctions` � all auctions (any status)
  - `DELETE /api/admin/auctions/{id}` � remove any listing
- `[ ]` **12.6** Build `src/pages/AdminDashboard.tsx` � users table + auctions table with remove button; route-guarded to `is_admin` users only

**? Day 12 Goal:** Admin can view/remove any listing; watchlist add/remove/list all work correctly

---

## ?? Day 13 � Testing Suite
> **Theme:** Automated tests for critical paths

- `[ ]` **13.1** Configure `pytest` + `pytest-asyncio` � `conftest.py` with async test DB session and `AsyncClient` (httpx); rollback after each test
- `[ ]` **13.2** Auth tests (`tests/test_auth.py`):
  - Register new user ? 201
  - Duplicate email ? 400
  - Login correct password ? returns JWT
  - Login wrong password ? 401
  - `GET /me` with valid token ? returns user
  - `GET /me` with no token ? 401
- `[ ]` **13.3** Bid concurrency test (`tests/test_bids.py`):
  - `asyncio.gather()` fires 2 simultaneous bids on same auction
  - Assert exactly 1 is 200; exactly 1 is 400/409
  - Assert DB has exactly 1 new bid row
- `[ ]` **13.4** Scheduler test (`tests/test_scheduler.py`):
  - Create auction with `end_time = now - 1min`
  - Call scheduler job directly
  - Assert `auction.status == 'closed'`; winner notification exists in DB
- `[ ]` **13.5** Webhook test (`tests/test_payments.py`):
  - Mock `stripe.Webhook.construct_event()` to return fake event
  - POST `checkout.session.completed` payload
  - Assert `payment.status == 'succeeded'`; `auction.status == 'paid'`
- `[ ]` **13.6** Run `pytest -v` � all tests must pass ?

**? Day 13 Goal:** Full test suite passes green � concurrency, auth, scheduler, and webhook all verified

---

## ?? Day 14 � Polish, Security & Mobile Responsiveness
> **Theme:** Production-ready hardening; great UX on all screen sizes

### Security & Validation
- `[ ]` **14.1** Audit all endpoints � Pydantic validation on every route; structured `{ detail: ... }` error responses
- `[ ]` **14.2** Confirm Stripe webhook signature always verified before acting on payload
- `[ ]` **14.3** Lock CORS to production frontend domain (not `*`)
- `[ ]` **14.4** Grep codebase for hardcoded secrets � confirm all via env vars
- `[ ]` **14.5** Add security headers middleware (`X-Content-Type-Options`, `X-Frame-Options`)

### Frontend Polish
- `[ ]` **14.6** Mobile audit at 375px, 768px, 1280px � navbar hamburger, 1-column grid, accessible bid form
- `[ ]` **14.7** Add skeleton loaders to auction list and detail pages
- `[ ]` **14.8** Add empty state messages � "No auctions found", "No bids yet", "Watchlist is empty"
- `[ ]` **14.9** Add React error boundary � catch unexpected errors, show user-friendly fallback
- `[ ]` **14.10** Verify all toast notifications fire correctly (bid placed, outbid, errors)
- `[ ]` **14.11** Add favicon + `<meta>` description/title tags to `index.html`

**? Day 14 Goal:** App is secure, validated, mobile-responsive, and polished with good UX details

---

## ?? Day 15 � Deployment & Final Documentation ??
> **Theme:** Ship it. Public URL, live data, complete README.

### Database
- `[ ]` **15.1** Create production PostgreSQL on Neon or Supabase (free tier)
- `[ ]` **15.2** Run `alembic upgrade head` against prod DB � verify all tables created

### Backend (Render / Railway)
- `[ ]` **15.3** Create `Procfile`: `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- `[ ]` **15.4** Deploy backend � set all env vars: `DATABASE_URL`, `JWT_SECRET_KEY`, `STRIPE_*`, `CLOUDINARY_*`
- `[ ]` **15.5** Verify health: `GET https://your-backend.com/api/auth/me` returns 401 (not 500)
- `[ ]` **15.6** Register production webhook endpoint in Stripe dashboard

### Frontend (Vercel)
- `[ ]` **15.7** Set `VITE_API_URL=https://your-backend.com` in Vercel env vars
- `[ ]` **15.8** Deploy `client/` to Vercel � connect GitHub, auto-deploy on push
- `[ ]` **15.9** Verify frontend loads and hits backend with no CORS errors

### End-to-End Smoke Test
- `[ ]` **15.10** Register two accounts (Seller + Buyer) on live URL
- `[ ]` **15.11** Seller: create live auction with image upload
- `[ ]` **15.12** Buyer: place bid ? verify real-time update in Seller's tab
- `[ ]` **15.13** Wait for auto-close ? verify winner determined
- `[ ]` **15.14** Winner: complete Stripe test payment (`4242 4242 4242 4242`) ? verify `status=paid`

### Documentation
- `[ ]` **15.15** Write complete `README.md`:
  - Project description + live URL
  - Architecture overview
  - Database schema summary
  - **Concurrency design decision** � explain `SELECT ... FOR UPDATE` and why it matters
  - Local setup instructions
  - Environment variables reference table

**? Day 15 Goal:** App is LIVE at a public URL. README explains everything. Project is interview-ready. ??

---

## ?? Summary

| Day | Theme | Key Deliverable |
|-----|-------|-----------------|
| 1 | Scaffolding | Servers running, folder structure ready |
| 2 | DB Models | All 6 tables in PostgreSQL |
| 3 | Auth Backend | Register / Login / JWT working |
| 4 | Auth Frontend | Login UI, session persistence |
| 5 | Auction Backend | CRUD + Cloudinary images |
| 6 | Auction Frontend | Browse, filter, create auctions |
| 7 | Bidding ? | Concurrency-safe bids (row locking) |
| 8 | WebSocket | Live updates across browser tabs |
| 9 | Scheduler + Notifications | Auto-close, notify users |
| 10 | Notifications UI + Stripe Backend | Bell icon, checkout, webhook |
| 11 | Payments UI + Dashboards | Full buyer/seller experience |
| 12 | Admin + Watchlist | Admin panel, watchlist feature |
| 13 | Testing | Auth, concurrency, webhook tests pass |
| 14 | Polish + Security | Mobile-ready, validated, hardened |
| 15 | Deployment ?? | Live URL, README, smoke tested |

---

> **?? Pro Tip:** Start each day by reviewing the previous day's ? Goal. If not fully met, finish it first.
> **Day 7 (Bidding Concurrency)** is the most technically critical � never rush it.





