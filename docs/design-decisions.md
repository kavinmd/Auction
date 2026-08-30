# AuctionSphere — Design Decisions

## Failed Payment Policy

**Rule:** No automatic auction re-opening after payment failure.

After a `checkout.session.completed` event, the auction is marked `paid`.  
If the buyer's card is declined (payment intent fails) or they cancel the Stripe checkout:

1. The `payment.status` is set to `failed` (or stays `pending` if they cancelled before submitting).
2. **The auction status is NOT changed** — it remains `closed`.
3. The winner has **48 hours** to retry payment by calling `POST /api/payments/checkout/{auction_id}` again. This creates a new Stripe Checkout session and resets the payment row to `pending`.
4. After 48 hours without a successful payment, **the seller must manually relist** the item as a new auction. There is no automated re-listing.

**Rationale:** Automated re-listing introduces edge cases (what happens to existing bids? do outbid notifications re-fire?). The simpler and safer approach is to keep humans in the loop for the exceptional case of non-payment, and let the seller decide whether to relist.

---

## Concurrency — Bid Placement (`SELECT ... FOR UPDATE`)

All bid placements acquire a **PostgreSQL row-level exclusive lock** on the auction row before validating and writing. This guarantees:

- Two simultaneous bids cannot both read the same `current_price` and both succeed.
- Exactly one bid wins in a concurrent race; the other receives a `400 Bad Request`.
- The audit trail in `bids` has exactly one row per valid bid — no duplicates, no ghost bids.

---

## Anti-Sniping

If a bid is placed within the **last 60 seconds** of an auction, `end_time` is extended by **2 minutes**. This prevents last-second sniping that gives other bidders no time to respond.

---

## WebSocket Architecture

- One `ConnectionManager` singleton holds `Dict[auction_id → List[WebSocket]]`.
- The scheduler and bid service call `manager.broadcast()` after every DB commit.
- Auto-reconnect with exponential backoff is handled on the client (`useAuctionSocket` hook).

---

## Image Uploads

Images are uploaded directly to **Cloudinary**. The server receives the file, streams it to Cloudinary, and stores only the secure URL in the DB. No images are stored on the application server — this keeps the server stateless and horizontally scalable.
