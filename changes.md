# AuctionSphere — Changes Needed Before This Goes on Your Resume

Reviewed: live repo (`github.com/kavinmd/Auction`, 15 commits) + live deploy (`auction-two-black.vercel.app`)

**Overall verdict:** The engineering is genuinely solid — concurrency-safe bidding (`SELECT ... FOR UPDATE`), a real race-condition test using `asyncio.gather()`, rate limiting, security headers, and Stripe webhook signature verification are all correctly implemented. The gaps below are about *presentation and production hardening*, not core functionality.

---

## Priority 1 — Do these first (high visibility, low effort)

### 1. Fix the root README.md
It currently still says *"Coming soon after deployment on Day 15"* even though the app is live. This is the first thing any interviewer sees. Update it to include:
- [ ] Live URL linked at the top
- [ ] 2–3 screenshots or a short GIF of a live bid updating across two browser tabs (your best "wow" moment)
- [ ] Demo/test login credentials (you already have `seed.py` — document what it seeds)
- [ ] The concurrency design explanation (currently only in `docs/design-decisions.md`) — surface it in the README directly

### 2. Reconcile task.md with reality
Every checkbox in `task.md` is still `[ ]` unchecked despite the features being built. Either:
- [ ] Check off completed items, or
- [ ] Add a note at the top: "Planning doc — see README for current build status"

An unchecked 15-day plan next to a finished, deployed app looks inconsistent to a skimming reviewer.

---

## Priority 2 — Production correctness (verify, don't assume)

### 3. Confirm Cloudinary is actually active in production
`cloudinary_service.py` silently falls back to local disk storage if credentials look like placeholders. This is smart for local dev, but Render/Railway filesystems are ephemeral — any image saved locally disappears on redeploy/restart.
- [ ] Log into your backend host and confirm `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` are set to real values (not placeholders)
- [ ] Your own `docs/design-decisions.md` claims "no images stored on the app server" — make sure that's true in prod, not just in intent

### 4. Confirm CORS is locked to the real frontend URL
`main.py` restricts CORS to a single `settings.frontend_url`. Confirm the deployed backend's `FRONTEND_URL` env var is set to `https://auction-two-black.vercel.app` exactly — not `localhost`. If it's wrong, auth/bidding will silently fail cross-origin in prod even though everything works locally.

### 5. Run a full end-to-end smoke test on the live URL
- [ ] Register two accounts (seller + buyer)
- [ ] Create an auction with an image upload
- [ ] Bid from two open tabs, confirm both update live via WebSocket
- [ ] Let an auction expire, confirm the scheduler auto-closes it and picks a winner
- [ ] Complete a Stripe test payment (`4242 4242 4242 4242`), confirm status flips to `paid`

Free-tier hosts (Render/Railway) often sleep when idle, which can delay the 60s scheduler job or drop the first WebSocket connection — worth catching before an interview, not during one.

---

## Priority 3 — Nice-to-haves that strengthen the resume story

### 6. Add a CI badge
No GitHub Actions workflow currently runs your `pytest` suite on push. A simple workflow + a green "tests passing" badge in the README is low effort and turns your test suite into visible proof instead of a claim in a paragraph.

### 7. Add a short architecture diagram
A simple diagram (client → API → Postgres, WebSocket connection manager, scheduler, Stripe webhook) in the README gives reviewers a 10-second mental model before they read code.

---

## What NOT to touch
- The bid concurrency logic (`bid_service.py`) — correct as-is, don't second-guess it
- The commit history — 15 well-scoped, descriptively-named commits is good; no rewriting needed
- The test suite structure — auth, bids (including the concurrency test), scheduler, and payment webhook are all covered appropriately
