import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { getAuctions, deleteAuction, markShipped } from "../api/auctions";
import type { Auction } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCurrency(amount: number | string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

type Tab = "listings" | "sold";

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SellerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("listings");

  // My Listings state
  const [listings, setListings] = useState<Auction[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sold Items state
  const [soldItems, setSoldItems] = useState<Auction[]>([]);
  const [soldLoading, setSoldLoading] = useState(false);
  const [shippingId, setShippingId] = useState<string | null>(null);

  // ── Fetch data per tab ─────────────────────────────────────────────────────

  const loadListings = useCallback(async () => {
    if (!user) return;
    setListingsLoading(true);
    try {
      // Fetch all statuses for this seller
      const [open, closed, cancelled] = await Promise.all([
        getAuctions({ seller_id: user.id, status: "open", limit: 50 }),
        getAuctions({ seller_id: user.id, status: "closed", limit: 50 }),
        getAuctions({ seller_id: user.id, status: "cancelled", limit: 50 }),
      ]);
      const all = [...open.items, ...closed.items, ...cancelled.items];
      // Sort: open first, then by end_time
      all.sort((a, b) => {
        if (a.status === "open" && b.status !== "open") return -1;
        if (a.status !== "open" && b.status === "open") return 1;
        return new Date(a.end_time).getTime() - new Date(b.end_time).getTime();
      });
      setListings(all);
    } catch {
      toast.error("Failed to load your listings");
    } finally {
      setListingsLoading(false);
    }
  }, [user]);

  const loadSoldItems = useCallback(async () => {
    if (!user) return;
    setSoldLoading(true);
    try {
      const [closed, paid] = await Promise.all([
        getAuctions({ seller_id: user.id, status: "closed", limit: 50 }),
        getAuctions({ seller_id: user.id, status: "paid", limit: 50 }),
      ]);
      const all = [...closed.items, ...paid.items];
      all.sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime());
      setSoldItems(all);
    } catch {
      toast.error("Failed to load sold items");
    } finally {
      setSoldLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === "listings") loadListings();
    else if (activeTab === "sold") loadSoldItems();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleDelete = async (auction: Auction) => {
    if (!window.confirm(`Delete "${auction.title}"? This cannot be undone.`)) return;
    setDeletingId(auction.id);
    try {
      await deleteAuction(auction.id);
      setListings((prev) => prev.filter((a) => a.id !== auction.id));
      toast.success("Auction deleted");
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Failed to delete auction";
      toast.error(detail);
    } finally {
      setDeletingId(null);
    }
  };

  const handleMarkShipped = async (auctionId: string) => {
    setShippingId(auctionId);
    try {
      const updated = await markShipped(auctionId);
      setSoldItems((prev) =>
        prev.map((a) => (a.id === updated.id ? { ...a, is_shipped: true } : a))
      );
      toast.success("Item marked as shipped! 📦");
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Failed to mark as shipped";
      toast.error(detail);
    } finally {
      setShippingId(null);
    }
  };

  // ── Sub-components ─────────────────────────────────────────────────────────

  function ListingsTab() {
    if (listingsLoading) return <SkeletonRows />;
    if (listings.length === 0) {
      return (
        <div className="dashboard-empty">
          <span className="dashboard-empty-icon">🏷️</span>
          <h3>No listings yet</h3>
          <p>Create your first auction and start selling.</p>
          <Link to="/auctions/create" className="btn btn--primary">
            + Create Auction
          </Link>
        </div>
      );
    }
    return (
      <div className="dashboard-table-wrap">
        <div className="dashboard-table-header-row">
          <span>{listings.length} listing{listings.length !== 1 ? "s" : ""}</span>
          <Link to="/auctions/create" className="btn btn--sm btn--primary">
            + New Listing
          </Link>
        </div>
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Current Price</th>
              <th>Bids</th>
              <th>End Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((auction) => {
              const isOpen = auction.status === "open";
              const hasBids = (auction.bid_count ?? 0) > 0;
              const isDeleting = deletingId === auction.id;
              return (
                <tr key={auction.id}>
                  <td>
                    <Link
                      to={`/auctions/${auction.id}`}
                      className="dashboard-table__link"
                    >
                      {auction.title}
                    </Link>
                  </td>
                  <td>
                    <span className={`badge badge--status-${auction.status}`}>
                      {statusLabel(auction.status)}
                    </span>
                  </td>
                  <td>
                    <span className="dashboard-table__amount">
                      {formatCurrency(auction.current_price)}
                    </span>
                  </td>
                  <td>
                    <span className="dashboard-table__bids">
                      ⚡ {auction.bid_count ?? 0}
                    </span>
                  </td>
                  <td className="dashboard-table__muted">
                    {new Date(auction.end_time).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="dashboard-table__actions-cell">
                    <Link
                      to={`/auctions/${auction.id}`}
                      className="btn btn--sm btn--ghost"
                    >
                      View
                    </Link>
                    {isOpen && !hasBids && (
                      <>
                        <button
                          className="btn btn--sm btn--ghost"
                          onClick={() => navigate(`/auctions/${auction.id}`)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn--sm btn--danger"
                          onClick={() => handleDelete(auction)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? "…" : "Delete"}
                        </button>
                      </>
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

  function SoldTab() {
    if (soldLoading) return <SkeletonRows />;
    if (soldItems.length === 0) {
      return (
        <div className="dashboard-empty">
          <span className="dashboard-empty-icon">📦</span>
          <h3>No sold items yet</h3>
          <p>When your auctions close with bids, they'll appear here.</p>
          <Link to="/" className="btn btn--primary">Browse Marketplace</Link>
        </div>
      );
    }
    return (
      <div className="dashboard-table-wrap">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Final Price</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Shipped</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {soldItems.map((auction) => {
              const isPaid = auction.status === "paid";
              const isShipped = auction.is_shipped;
              const isShipping = shippingId === auction.id;
              return (
                <tr key={auction.id}>
                  <td>
                    <Link
                      to={`/auctions/${auction.id}`}
                      className="dashboard-table__link"
                    >
                      {auction.title}
                    </Link>
                  </td>
                  <td>
                    <span className="dashboard-table__amount">
                      {formatCurrency(auction.current_price)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge--status-${auction.status}`}>
                      {statusLabel(auction.status)}
                    </span>
                  </td>
                  <td>
                    {isPaid ? (
                      <span className="badge badge--winning">✓ Paid</span>
                    ) : (
                      <span className="badge badge--outbid">⏳ Pending</span>
                    )}
                  </td>
                  <td>
                    {isShipped ? (
                      <span className="badge badge--shipped">📦 Shipped</span>
                    ) : (
                      <span className="badge badge--neutral">Not shipped</span>
                    )}
                  </td>
                  <td className="dashboard-table__actions-cell">
                    <Link
                      to={`/auctions/${auction.id}`}
                      className="btn btn--sm btn--ghost"
                    >
                      View
                    </Link>
                    {isPaid && !isShipped && (
                      <button
                        id={`ship-btn-${auction.id}`}
                        className="btn btn--sm btn--success"
                        onClick={() => handleMarkShipped(auction.id)}
                        disabled={isShipping}
                      >
                        {isShipping ? "Marking…" : "📦 Mark Shipped"}
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
    { id: "listings", label: "My Listings", icon: "🏷️" },
    { id: "sold", label: "Sold Items", icon: "📦" },
  ];

  return (
    <div className="dashboard-page">
      {/* Header */}
      <div className="dashboard-header dashboard-header--seller">
        <div className="dashboard-header__inner">
          <div className="dashboard-header__avatar dashboard-header__avatar--seller">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="dashboard-header__title">Seller Dashboard</h1>
            <p className="dashboard-header__sub">
              {user?.name} · Manage your listings and track sales
            </p>
          </div>
          <Link
            to="/auctions/create"
            className="btn btn--primary dashboard-header__cta"
          >
            + Create Auction
          </Link>
        </div>
      </div>

      {/* Tab nav */}
      <div className="dashboard-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`seller-tab-${tab.id}`}
            className={`dashboard-tab ${activeTab === tab.id ? "dashboard-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="dashboard-content">
        {activeTab === "listings" && <ListingsTab />}
        {activeTab === "sold" && <SoldTab />}
      </div>
    </div>
  );
}

// ── Skeleton loader ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="dashboard-skeleton">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="dashboard-skeleton__row">
          <div className="skeleton-block" style={{ width: "30%" }} />
          <div className="skeleton-block" style={{ width: "12%" }} />
          <div className="skeleton-block" style={{ width: "15%" }} />
          <div className="skeleton-block" style={{ width: "10%" }} />
          <div className="skeleton-block" style={{ width: "18%" }} />
        </div>
      ))}
    </div>
  );
}
