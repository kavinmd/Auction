import { Link, useSearchParams } from "react-router-dom";

export default function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const auctionId = searchParams.get("auction_id");

  return (
    <div className="payment-page">
      <div className="payment-card payment-card--cancel">
        {/* X icon */}
        <div className="payment-icon payment-icon--cancel">
          <svg viewBox="0 0 52 52" width="72" height="72">
            <circle cx="26" cy="26" r="25" fill="none" stroke="var(--color-danger)" strokeWidth="2" />
            <line x1="16" y1="16" x2="36" y2="36" stroke="var(--color-danger)" strokeWidth="3" strokeLinecap="round" />
            <line x1="36" y1="16" x2="16" y2="36" stroke="var(--color-danger)" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="payment-title">Payment Cancelled</h1>
        <p className="payment-subtitle">
          Your payment was cancelled or did not complete. No charges have been made.
        </p>

        <div className="payment-info-box">
          <p className="payment-info-text">
            ⏰ <strong>Important:</strong> As the auction winner, you have{" "}
            <strong>48 hours</strong> to complete payment. After that, the seller
            may relist the item.
          </p>
        </div>

        <div className="payment-actions">
          {auctionId && (
            <Link to={`/auctions/${auctionId}`} className="btn btn--primary">
              Try Payment Again
            </Link>
          )}
          <Link to="/" className="btn btn--ghost">
            Go to Auctions
          </Link>
        </div>

        <p className="payment-footnote">
          If you believe this is an error, please contact support.
        </p>
      </div>
    </div>
  );
}
