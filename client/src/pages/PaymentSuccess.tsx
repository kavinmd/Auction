import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getPaymentByAuction } from "../api/payments";
import type { Payment } from "../types";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const auctionId = searchParams.get("auction_id");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auctionId) { setLoading(false); return; }
    getPaymentByAuction(auctionId)
      .then(setPayment)
      .catch(() => setPayment(null))
      .finally(() => setLoading(false));
  }, [auctionId]);

  return (
    <div className="payment-page">
      <div className="payment-card payment-card--success">
        {/* Animated checkmark */}
        <div className="payment-icon payment-icon--success">
          <svg viewBox="0 0 52 52" className="payment-checkmark">
            <circle cx="26" cy="26" r="25" fill="none" className="payment-checkmark__circle" />
            <path fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" className="payment-checkmark__check" />
          </svg>
        </div>

        <h1 className="payment-title">Payment Successful! 🎉</h1>
        <p className="payment-subtitle">
          Your payment has been processed and the auction has been marked as paid.
        </p>

        {loading ? (
          <div className="payment-skeleton" />
        ) : payment ? (
          <div className="payment-detail-box">
            <div className="payment-detail-row">
              <span className="payment-detail-label">Amount Paid</span>
              <span className="payment-detail-value payment-detail-value--accent">
                ${Number(payment.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="payment-detail-row">
              <span className="payment-detail-label">Payment Status</span>
              <span className="payment-status-badge payment-status-badge--succeeded">
                ✓ Succeeded
              </span>
            </div>
            <div className="payment-detail-row">
              <span className="payment-detail-label">Auction ID</span>
              <span className="payment-detail-value payment-detail-value--mono">
                {payment.auction_id.slice(0, 8)}…
              </span>
            </div>
          </div>
        ) : null}

        <div className="payment-actions">
          {auctionId && (
            <Link to={`/auctions/${auctionId}`} className="btn btn--primary">
              View Auction
            </Link>
          )}
          <Link to="/" className="btn btn--ghost">
            Browse More Auctions
          </Link>
        </div>

        <p className="payment-footnote">
          The seller will be notified and will arrange delivery shortly.
        </p>
      </div>
    </div>
  );
}
