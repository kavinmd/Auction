import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { getMyBids } from "../api/bids";
import { getMyWatchlist, removeFromWatchlist } from "../api/watchlist";
import { getAuctions } from "../api/auctions";
import { createCheckoutSession } from "../api/payments";
import type { Auction } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCurrency(amount: number | string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

function timeLeft(endTime: string): string {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

type Tab = "bids" | "watchlist" | "won";

interface UserBid {
  id: string;
  auction_id: string;
  amount: number;
  created_at: string;
  auction_title?: string;
  auction_current_price?: number;
  auction_status?: string;
  is_winning?: boolean;
  payment_status?: string | null;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function BuyerDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("bids");

  // My Bids state
  const [bids, setBids] = useState<UserBid[]>([]);
  const [bidsLoading, setBidsLoading] = useState(false);

  // Watchlist state
  const [watchlist, setWatchlist] = useState<Auction[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Won auctions state
  const [wonAuctions, setWonAuctions] = useState<Auction[]>([]);
  const [wonLoading, setWonLoading] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  // ── Fetch data per tab ─────────────────────────────────────────────────────

  const loadBids = useCallback(async () => {
    setBidsLoading(true);
    try {
      const data = await getMyBids();
      setBids(data);
    } catch {
      toast.error("Failed to load bids");
    } finally {
      setBidsLoading(false);
    }
  }, []);

  const loadWatchlist = useCallback(async () => {
    setWatchlistLoading(true);
    try {
      const data = await getMyWatchlist();
      setWatchlist(data);
    } catch {
      toast.error("Failed to load watchlist");
    } finally {
      setWatchlistLoading(false);
    }
  }, []);

  const loadWonAuctions = useCallback(async () => {
    if (!user) return;
    setWonLoading(true);
    try {
      // Fetch closed + paid auctions where user is the winner (highest bidder)
      const [closed, paid] = await Promise.all([
        getAuctions({ status: "closed", limit: 50 }),
        getAuctions({ status: "paid", limit: 50 }),
      ]);
      const all = [...closed.items, ...paid.items];
      // Filter: user must be the winning bidder — we rely on bids data already loaded
      // Use bids to cross-reference auction IDs where is_winning = true
      const winningAuctionIds = new Set(
        bids.filter((b) => b.is_winning).map((b) => b.auction_id)
      );
      const won = all.filter((a) => winningAuctionIds.has(a.id));
      setWonAuctions(won);
    } catch {
      toast.error("Failed to load won auctions");
    } finally {
      setWonLoading(false);
    }
  }, [user, bids]);

  // ── Tab switching ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab === "bids") loadBids();
    else if (activeTab === "watchlist") loadWatchlist();
    else if (activeTab === "won") {
      // Won tab needs bids first; if bids not yet loaded, load both
      if (bids.length === 0) {
        loadBids().then(() => loadWonAuctions());
      } else {
        loadWonAuctions();
      }
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleRemoveWatchlist = async (auctionId: string) => {
    setRemovingId(auctionId);
    try {
      await removeFromWatchlist(auctionId);
      setWatchlist((prev) => prev.filter((a) => a.id !== auctionId));
      toast.success("Removed from watchlist");
    } catch {
      toast.error("Failed to remove from watchlist");
    } finally {
      setRemovingId(null);
    }
  };

  const handlePayNow = async (auctionId: string) => {
    setPayingId(auctionId);
    try {
      const { checkout_url } = await createCheckoutSession(auctionId);
      window.location.href = checkout_url;
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Failed to create checkout session";
      toast.error(detail);
      setPayingId(null);
    }
  };

  // ── Sub-components ─────────────────────────────────────────────────────────

  function BidsTab() {
    if (bidsLoading) return <SkeletonRows />;
    if (bids.length === 0) {
      return (
        <div className="dashboard-empty">
          <span className="dashboard-empty-icon">⚡</span>
          <h3>No bids yet</h3>
          <p>Start bidding on live auctions to see your history here.</p>
          <Link to="/" className="btn btn--primary">Browse Auctions</Link>
        </div>
      );
    }
    return (
      <div className="dashboard-table-wrap">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Auction</th>
              <th>Your Bid</th>
              <th>Current Price</th>
              <th>Status</th>
              <th>Placed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bids.map((bid) => (
              <tr key={bid.id} className={bid.is_winning ? "dashboard-table__row--winning" : ""}>
                <td>
                  <span className="dashboard-table__title">
                    {bid.auction_title || `Auction #${bid.auction_id.slice(0, 8)}`}
                  </span>
                </td>
                <td>
                  <span className="dashboard-table__amount">
                    {formatCurrency(bid.amount)}
                  </span>
                </td>
                <td>{formatCurrency(bid.auction_current_price ?? 0)}</td>
                <td>
                  {bid.is_winning ? (
                    <span className="badge badge--winning">🏆 Winning</span>
                  ) : bid.auction_status === "open" ? (
                    <span className="badge badge--outbid">Outbid</span>
                  ) : bid.auction_status === "closed" || bid.auction_status === "paid" ? (
                    <span className="badge badge--lost">Lost</span>
                  ) : (
                    <span className="badge badge--neutral">{bid.auction_status}</span>
                  )}
                </td>
                <td className="dashboard-table__muted">
                  {new Date(bid.created_at).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </td>
                <td>
                  <Link
                    to={`/auctions/${bid.auction_id}`}
                    className="btn btn--sm btn--ghost"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function WatchlistTab() {
    if (watchlistLoading) return <SkeletonCards />;
    if (watchlist.length === 0) {
      return (
        <div className="dashboard-empty">
          <span className="dashboard-empty-icon">❤️</span>
          <h3>Your watchlist is empty</h3>
          <p>Save auctions you're interested in and track them here.</p>
          <Link to="/" className="btn btn--primary">Browse Auctions</Link>
        </div>
      );
    }
    return (
      <div className="dashboard-watchlist-grid">
        {watchlist.map((auction) => {
          const isRemoving = removingId === auction.id;
          const ended = auction.status !== "open";
          const diff = new Date(auction.end_time).getTime() - Date.now();
          const urgent = !ended && diff < 3600000;
          return (
            <div key={auction.id} className="watchlist-card">
              <Link to={`/auctions/${auction.id}`} className="watchlist-card__img-wrap">
                {auction.image_urls?.[0] ? (
                  <img src={auction.image_urls[0]} alt={auction.title} className="watchlist-card__img" />
                ) : (
                  <div className="watchlist-card__img-fallback">🏷️</div>
                )}
                <span className={`watchlist-card__status-badge ${ended ? "badge--closed" : urgent ? "badge--urgent" : "badge--open"}`}>
                  {ended ? auction.status.toUpperCase() : `⏱ ${timeLeft(auction.end_time)}`}
                </span>
              </Link>
              <div className="watchlist-card__body">
                <Link to={`/auctions/${auction.id}`} className="watchlist-card__title">
                  {auction.title}
                </Link>
                <div className="watchlist-card__price">
                  <span className="watchlist-card__price-label">Current Bid</span>
                  <span className="watchlist-card__price-val">
                    {formatCurrency(auction.current_price)}
                  </span>
                </div>
                <div className="watchlist-card__actions">
                  <Link to={`/auctions/${auction.id}`} className="btn btn--sm btn--primary">
                    View Auction
                  </Link>
                  <button
                    className="btn btn--sm btn--danger"
                    onClick={() => handleRemoveWatchlist(auction.id)}
                    disabled={isRemoving}
                  >
                    {isRemoving ? "Removing…" : "✕ Remove"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function WonTab() {
    if (wonLoading || bidsLoading) return <SkeletonRows />;
    if (wonAuctions.length === 0) {
      return (
        <div className="dashboard-empty">
          <span className="dashboard-empty-icon">🏆</span>
          <h3>No won auctions yet</h3>
          <p>When you win an auction, it will appear here with payment options.</p>
          <Link to="/" className="btn btn--primary">Browse Live Auctions</Link>
        </div>
      );
    }
    return (
      <div className="dashboard-table-wrap">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Auction</th>
              <th>Winning Bid</th>
              <th>Status</th>
              <th>Payment</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {wonAuctions.map((auction) => {
              const myBid = bids.find((b) => b.auction_id === auction.id && b.is_winning);
              const isPaid = auction.status === "paid";
              const isPaying = payingId === auction.id;
              return (
                <tr key={auction.id}>
                  <td>
                    <span className="dashboard-table__title">{auction.title}</span>
                  </td>
                  <td>
                    <span className="dashboard-table__amount">
                      {formatCurrency(myBid?.amount ?? auction.current_price)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${isPaid ? "badge--paid" : "badge--closed"}`}>
                      {auction.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {isPaid ? (
                      <span className="badge badge--winning">✓ Paid</span>
                    ) : (
                      <span className="badge badge--outbid">⏳ Pending</span>
                    )}
                  </td>
                  <td className="dashboard-table__actions-cell">
                    <Link to={`/auctions/${auction.id}`} className="btn btn--sm btn--ghost">
                      View
                    </Link>
                    {!isPaid && (
                      <button
                        id={`pay-now-btn-${auction.id}`}
                        className="btn btn--sm btn--primary"
                        onClick={() => handlePayNow(auction.id)}
                        disabled={isPaying}
                      >
                        {isPaying ? "Redirecting…" : "💳 Pay Now"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "bids", label: "My Bids", icon: "⚡" },
    { id: "watchlist", label: "My Watchlist", icon: "❤️" },
    { id: "won", label: "Won Auctions", icon: "🏆" },
  ];

  return (
    <div className="dashboard-page">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-header__inner">
          <div className="dashboard-header__avatar">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="dashboard-header__title">
              Welcome back, {user?.name?.split(" ")[0]}!
            </h1>
            <p className="dashboard-header__sub">Your buyer dashboard</p>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="dashboard-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`dashboard-tab-${tab.id}`}
            className={`dashboard-tab ${activeTab === tab.id ? "dashboard-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="dashboard-content">
        {activeTab === "bids" && <BidsTab />}
        {activeTab === "watchlist" && <WatchlistTab />}
        {activeTab === "won" && <WonTab />}
      </div>
    </div>
  );
}

// ── Skeleton loaders ───────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="dashboard-skeleton">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="dashboard-skeleton__row">
          <div className="skeleton-block" style={{ width: "35%" }} />
          <div className="skeleton-block" style={{ width: "15%" }} />
          <div className="skeleton-block" style={{ width: "15%" }} />
          <div className="skeleton-block" style={{ width: "12%" }} />
        </div>
      ))}
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="dashboard-watchlist-grid">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="watchlist-card watchlist-card--skeleton">
          <div className="skeleton-block watchlist-card__img-skeleton" />
          <div className="watchlist-card__body">
            <div className="skeleton-block" style={{ height: "18px", marginBottom: "8px" }} />
            <div className="skeleton-block" style={{ height: "14px", width: "60%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
