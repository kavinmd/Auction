import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { getAuction, deleteAuction } from "../api/auctions";
import { placeBid, getAuctionBids } from "../api/bids";
import type { Auction, Bid } from "../types";
import { useAuth } from "../context/AuthContext";

import { useAuctionSocket } from "../hooks/useAuctionSocket";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeOnly(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  totalSeconds: number;
}

function calculateTimeRemaining(endTimeStr: string): TimeRemaining {
  const end = new Date(endTimeStr).getTime();
  const now = Date.now();
  const diff = end - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, totalSeconds: 0 };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, isExpired: false, totalSeconds };
}

export default function AuctionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [bidAmount, setBidAmount] = useState<string>("");
  const [placingBid, setPlacingBid] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
    totalSeconds: 0,
  });

  // ── Real-time WebSocket hook ─────────────────────────────────────────────
  useAuctionSocket(id, {
    onNewBid: (data) => {
      setAuction((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          current_price: data.current_price,
          end_time: data.end_time,
          bid_count: (prev.bid_count ?? 0) + 1,
        };
      });

      const newBidItem: Bid = {
        id: data.id,
        auction_id: data.auction_id,
        bidder_id: data.bidder_id,
        amount: data.amount,
        created_at: data.created_at,
        bidder: {
          id: data.bidder_id,
          name: data.bidder_name,
          email: "",
        },
      };

      setBids((prev) => {
        if (prev.some((b) => b.id === data.id)) return prev;
        return [newBidItem, ...prev];
      });

      // Update suggested next minimum bid
      const nextMin = data.current_price + (data.current_price < 1000 ? 50 : 100);
      setBidAmount(String(nextMin));

      // Toast alert if bid came from another client
      if (data.bidder_id !== user?.id) {
        toast.success(`⚡ New live bid: ${formatCurrency(data.amount)} by ${data.bidder_name}!`);
      }
    },

    onTimeExtended: (data) => {
      setAuction((prev) => (prev ? { ...prev, end_time: data.new_end_time } : prev));
      setTimeRemaining(calculateTimeRemaining(data.new_end_time));
      toast("⏳ Anti-sniping: Auction extended by 2 minutes!", {
        icon: "⏳",
        style: { background: "#1e1b4b", color: "#c7d2fe", border: "1px solid #6366f1" },
      });
    },

    onAuctionClosed: () => {
      setAuction((prev) => (prev ? { ...prev, status: "closed" } : prev));
      toast("🏷️ This auction has now closed.", { icon: "🏷️" });
    },

    enabled: Boolean(auction && auction.status === "open"),
  });

  // Fetch auction data & bid history
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    Promise.all([getAuction(id), getAuctionBids(id)])
      .then(([auctionData, bidsData]) => {
        setAuction(auctionData);
        setBids(bidsData);
        setTimeRemaining(calculateTimeRemaining(auctionData.end_time));
        const curr = Number(auctionData.current_price ?? auctionData.starting_price);
        const nextMin = curr + (curr < 1000 ? 50 : 100);
        setBidAmount(String(nextMin));
      })
      .catch((err) => {
        console.error("Error fetching auction details:", err);
        setError(
          err?.response?.data?.detail || "Auction not found or failed to load."
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Live countdown timer
  useEffect(() => {
    if (!auction || auction.status !== "open") return;

    const timer = setInterval(() => {
      const remaining = calculateTimeRemaining(auction.end_time);
      setTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, [auction]);

  const isSeller = Boolean(user && auction && user.id === auction.seller_id);
  const isOpen = auction?.status === "open" && !timeRemaining.isExpired;

  const currentPrice = Number(auction?.current_price ?? auction?.starting_price ?? 0);
  const minNextBid = currentPrice + (currentPrice < 1000 ? 50 : 100);

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auction) return;

    const numAmount = parseFloat(bidAmount);
    if (isNaN(numAmount) || numAmount <= currentPrice) {
      toast.error(`Bid amount must be strictly greater than ${formatCurrency(currentPrice)}`);
      return;
    }

    setPlacingBid(true);
    try {
      const newBid = await placeBid(auction.id, numAmount);
      toast.success(`🎉 Bid of ${formatCurrency(numAmount)} placed successfully!`);

      // Update local state
      setAuction((prev) =>
        prev
          ? {
              ...prev,
              current_price: numAmount,
              bid_count: (prev.bid_count ?? 0) + 1,
            }
          : prev
      );
      setBids((prev) => [newBid, ...prev]);
      setBidAmount(String(numAmount + (numAmount < 1000 ? 50 : 100)));
    } catch (err: any) {
      console.error("Failed to place bid:", err);
      toast.error(err?.response?.data?.detail || "Failed to place bid.");
    } finally {
      setPlacingBid(false);
    }
  };

  const handleDelete = async () => {
    if (!auction) return;
    if ((auction.bid_count ?? 0) > 0) {
      toast.error("Cannot delete an auction that already has bids.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this auction listing? This action cannot be undone.")) {
      return;
    }

    setDeleting(true);
    try {
      await deleteAuction(auction.id);
      toast.success("Auction listing deleted successfully.");
      navigate("/auctions");
    } catch (err: any) {
      console.error("Delete failed:", err);
      toast.error(err?.response?.data?.detail || "Failed to delete auction.");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="auction-detail-loading">
        <div className="auth-loading-spinner" />
        <p>Loading auction details...</p>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="auction-detail-error-container">
        <div className="empty-state-icon">⚠️</div>
        <h2>Auction Not Found</h2>
        <p>{error || "The requested auction listing does not exist."}</p>
        <Link to="/auctions" className="btn btn--primary">
          &larr; Back to Live Auctions
        </Link>
      </div>
    );
  }

  const images = auction.image_urls && auction.image_urls.length > 0 ? auction.image_urls : [];

  return (
    <div className="auction-detail-page">
      {/* ── Breadcrumbs ── */}
      <nav className="detail-breadcrumbs">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/auctions">Auctions</Link>
        <span>/</span>
        <span className="breadcrumb-category">{auction.category}</span>
        <span>/</span>
        <span className="breadcrumb-current">{auction.title}</span>
      </nav>

      <div className="detail-layout">
        {/* ── Left: Image Gallery ── */}
        <div className="detail-gallery">
          <div className="detail-main-image-wrapper">
            {images.length > 0 ? (
              <img
                src={images[selectedImageIdx] || images[0]}
                alt={auction.title}
                className="detail-main-img"
              />
            ) : (
              <div className="detail-fallback-img">
                <span className="detail-fallback-icon">🏷️</span>
                <span>No images provided</span>
              </div>
            )}

            {/* Status Pill Badge */}
            <span
              className={`detail-status-badge detail-status-badge--${
                isOpen ? "open" : auction.status
              }`}
            >
              {isOpen ? "LIVE AUCTION" : auction.status.toUpperCase()}
            </span>
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="detail-thumbnails-strip">
              {images.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`detail-thumb-btn ${
                    selectedImageIdx === idx ? "detail-thumb-btn--active" : ""
                  }`}
                  onClick={() => setSelectedImageIdx(idx)}
                >
                  <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Auction Info & Bidding Box ── */}
        <div className="detail-info-pane">
          <div className="detail-header">
            <span className="detail-category-tag">{auction.category}</span>
            <h1 className="detail-title">{auction.title}</h1>
            <p className="detail-meta">
              Listed on {formatDate(auction.created_at)}
            </p>
          </div>

          {/* ── Countdown Timer Box ── */}
          <div
            className={`detail-timer-box ${
              timeRemaining.totalSeconds < 3600 && isOpen
                ? "detail-timer-box--urgent"
                : ""
            }`}
          >
            <div className="timer-box-header">
              <span className="timer-box-icon">⏳</span>
              <span className="timer-box-label">
                {isOpen ? "Time Remaining" : "Auction Status"}
              </span>
            </div>

            {isOpen ? (
              <div className="timer-digits-grid">
                <div className="timer-digit-unit">
                  <span className="timer-val">{timeRemaining.days}</span>
                  <span className="timer-sub">Days</span>
                </div>
                <span className="timer-colon">:</span>
                <div className="timer-digit-unit">
                  <span className="timer-val">
                    {String(timeRemaining.hours).padStart(2, "0")}
                  </span>
                  <span className="timer-sub">Hours</span>
                </div>
                <span className="timer-colon">:</span>
                <div className="timer-digit-unit">
                  <span className="timer-val">
                    {String(timeRemaining.minutes).padStart(2, "0")}
                  </span>
                  <span className="timer-sub">Mins</span>
                </div>
                <span className="timer-colon">:</span>
                <div className="timer-digit-unit">
                  <span className="timer-val timer-val--sec">
                    {String(timeRemaining.seconds).padStart(2, "0")}
                  </span>
                  <span className="timer-sub">Secs</span>
                </div>
              </div>
            ) : (
              <div className="auction-ended-alert">
                <span>Auction has ended</span>
                <small>Ended on {formatDate(auction.end_time)}</small>
              </div>
            )}
          </div>

          {/* ── Price & Bid Box ── */}
          <div className="detail-price-box">
            <div className="detail-price-row">
              <div>
                <span className="detail-price-label">
                  {(auction.bid_count ?? 0) > 0 ? "Current Highest Bid" : "Starting Bid"}
                </span>
                <div className="detail-current-price">
                  {formatCurrency(currentPrice)}
                </div>
              </div>

              <div className="detail-bids-stat">
                <span className="bids-stat-count">⚡ {auction.bid_count ?? 0}</span>
                <span className="bids-stat-label">Total Bids</span>
              </div>
            </div>

            {/* Starting price reference if there are bids */}
            {(auction.bid_count ?? 0) > 0 && (
              <div className="detail-starting-ref">
                Starting Price: <strong>{formatCurrency(Number(auction.starting_price))}</strong>
              </div>
            )}

            {/* Actions / Bidding Zone */}
            {isSeller ? (
              <div className="seller-action-box">
                <div className="seller-badge-banner">
                  <span>👑 You are the seller of this listing</span>
                </div>

                <div className="seller-buttons-row">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => toast("Editing feature is enabled for open listings without bids.")}
                  >
                    ✏️ Edit Listing
                  </button>

                  <button
                    type="button"
                    className="btn btn--danger"
                    disabled={deleting || (auction.bid_count ?? 0) > 0}
                    onClick={handleDelete}
                    title={
                      (auction.bid_count ?? 0) > 0
                        ? "Cannot delete an auction with bids"
                        : "Delete this auction"
                    }
                  >
                    {deleting ? "Deleting..." : "🗑️ Delete Listing"}
                  </button>
                </div>
                {(auction.bid_count ?? 0) > 0 && (
                  <p className="seller-delete-hint">
                    Listing cannot be deleted because bids have already been placed.
                  </p>
                )}
              </div>
            ) : isOpen ? (
              <div className="bid-placement-container">
                {isAuthenticated ? (
                  <form onSubmit={handlePlaceBid} className="bid-preview-form">
                    <div className="bid-helper-text">
                      Suggested minimum bid: <strong>{formatCurrency(minNextBid)}</strong>
                    </div>
                    <div className="bid-input-group">
                      <span className="currency-prefix">₹</span>
                      <input
                        type="number"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        min={minNextBid}
                        step="1"
                        className="bid-input"
                        placeholder="Enter your bid"
                        required
                        disabled={placingBid}
                      />
                      <button
                        type="submit"
                        className="btn btn--primary bid-submit-btn"
                        disabled={placingBid}
                      >
                        {placingBid ? (
                          <>
                            <span className="btn-spinner" />
                            <span>Placing...</span>
                          </>
                        ) : (
                          <>⚡ Place Bid</>
                        )}
                      </button>
                    </div>
                    <p className="bid-notice">
                      🔒 All bids are binding. Anti-sniping protection extends the timer by 2 mins if placed within the last 60s.
                    </p>
                  </form>
                ) : (
                  <div className="auth-required-box">
                    <p>You must be logged in to participate in bidding.</p>
                    <Link to="/login" className="btn btn--primary">
                      Log In to Bid
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="auction-closed-box">
                <p>This auction is no longer accepting bids.</p>
              </div>
            )}
          </div>

          {/* ── Seller Info Card ── */}
          <div className="detail-seller-card">
            <div className="seller-avatar">
              {auction.seller?.name ? auction.seller.name.charAt(0).toUpperCase() : "S"}
            </div>
            <div className="seller-info">
              <span className="seller-title">Verified Seller</span>
              <span className="seller-name">{auction.seller?.name || "Seller"}</span>
              <span className="seller-email">{auction.seller?.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Description & Bid History Tabs ── */}
      <div className="detail-bottom-section">
        <div className="detail-desc-card">
          <h2 className="section-heading">Item Description</h2>
          <div className="detail-desc-text">
            {auction.description.split("\n").map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>
        </div>

        <div className="detail-bids-card">
          <h2 className="section-heading">Bid History ({bids.length})</h2>
          {bids.length > 0 ? (
            <div className="bid-history-list">
              {bids.map((b, idx) => {
                const bidderName = b.bidder?.name
                  ? isSeller || b.bidder_id === user?.id
                    ? b.bidder.name
                    : `${b.bidder.name.slice(0, 1)}***${b.bidder.name.slice(-1)}`
                  : `Bidder #${bids.length - idx}`;

                return (
                  <div
                    key={b.id || idx}
                    className={`bid-history-item ${idx === 0 ? "bid-history-item--leading" : ""}`}
                  >
                    <div className="bid-history-bidder">
                      <span className="bidder-badge">
                        {idx === 0 ? "⚡ Leading Bid" : `🏷️ ${bidderName}`}
                      </span>
                      <span className="bid-history-time">
                        {formatTimeOnly(b.created_at)}
                      </span>
                    </div>
                    <span className="bid-history-amount">
                      {formatCurrency(Number(b.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="no-bids-state">
              <span>🏷️</span>
              <p>No bids have been placed yet. Be the first bidder!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
