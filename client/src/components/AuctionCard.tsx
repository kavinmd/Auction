import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import type { Auction } from "../types";

interface AuctionCardProps {
  auction: Auction;
  onRemove?: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function getTimeRemaining(endTimeStr: string, status: string) {
  if (status !== "open") {
    return {
      text: status.toUpperCase(),
      variant: "closed" as const,
      isExpired: true,
    };
  }

  const end = new Date(endTimeStr).getTime();
  const now = Date.now();
  const diff = end - now;

  if (diff <= 0) {
    return {
      text: "ENDED",
      variant: "closed" as const,
      isExpired: true,
    };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return {
      text: `${days}d ${hours}h left`,
      variant: "normal" as const,
      isExpired: false,
    };
  }
  if (hours > 0) {
    return {
      text: `${hours}h ${minutes}m left`,
      variant: hours < 4 ? ("warning" as const) : ("normal" as const),
      isExpired: false,
    };
  }
  return {
    text: `${minutes}m ${seconds}s left`,
    variant: "urgent" as const,
    isExpired: false,
  };
}

export default function AuctionCard({ auction, onRemove }: AuctionCardProps) {
  const [timeInfo, setTimeInfo] = useState(() =>
    getTimeRemaining(auction.end_time, auction.status)
  );

  useEffect(() => {
    if (auction.status !== "open") return;

    const timer = setInterval(() => {
      setTimeInfo(getTimeRemaining(auction.end_time, auction.status));
    }, 1000);

    return () => clearInterval(timer);
  }, [auction.end_time, auction.status]);

  const hasImage = auction.image_urls && auction.image_urls.length > 0;
  const mainImage = hasImage ? auction.image_urls[0] : null;

  return (
    <Link to={`/auctions/${auction.id}`} className="auction-card">
      {/* ── Image Container ── */}
      <div className="auction-card-media">
        {mainImage ? (
          <img
            src={mainImage}
            alt={auction.title}
            className="auction-card-img"
            loading="lazy"
          />
        ) : (
          <div className="auction-card-fallback-img">
            <span className="auction-card-fallback-icon">🏷️</span>
            <span>No Image</span>
          </div>
        )}

        {/* Category Pill */}
        <span className="auction-card-category-badge">
          {auction.category}
        </span>

        {/* Time Remaining Badge */}
        <div
          className={`auction-card-timer-badge auction-card-timer-badge--${timeInfo.variant}`}
        >
          {timeInfo.variant === "urgent" && <span className="pulse-dot" />}
          <span>{timeInfo.text}</span>
        </div>
      </div>

      {/* ── Card Content ── */}
      <div className="auction-card-body">
        <h3 className="auction-card-title" title={auction.title}>
          {auction.title}
        </h3>

        {/* Bid info row */}
        <div className="auction-card-pricing">
          <div className="auction-card-price-col">
            <span className="auction-card-price-label">
              {(auction.bid_count ?? 0) > 0 ? "Current Bid" : "Starting Price"}
            </span>
            <span className="auction-card-price-val">
              {formatCurrency(auction.current_price ?? auction.starting_price)}
            </span>
          </div>

          <div className="auction-card-bids-col">
            <span className="auction-card-bids-count">
              ⚡ {auction.bid_count ?? 0} {(auction.bid_count ?? 0) === 1 ? "bid" : "bids"}
            </span>
          </div>
        </div>

        {/* Action button bar */}
        <div className="auction-card-footer">
          <span className="auction-card-cta">
            View Listing <span>&rarr;</span>
          </span>
          {onRemove && (
            <button
              className="auction-card-remove-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove();
              }}
              title="Remove from watchlist"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
