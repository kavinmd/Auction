import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import api from "../api/axiosInstance";
import type { User, Auction } from "../types";

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchAdminUsers(): Promise<User[]> {
  const res = await api.get<User[]>("/admin/users");
  return res.data;
}

async function fetchAdminAuctions(params: {
  page: number;
  limit: number;
  status?: string;
  keyword?: string;
}): Promise<{ items: Auction[]; total: number; has_more: boolean }> {
  const res = await api.get("/admin/auctions", { params });
  return res.data;
}

async function adminDeleteAuction(id: string): Promise<void> {
  await api.delete(`/admin/auctions/${id}`);
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "badge badge--green",
    closed: "badge badge--gray",
    paid: "badge badge--blue",
    cancelled: "badge badge--red",
  };
  return (
    <span className={map[status] ?? "badge badge--gray"}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card admin-confirm-modal">
        <h3 className="modal-card__title">{title}</h3>
        <p className="modal-card__body">{message}</p>
        <div className="modal-card__actions">
          <button className="btn btn--ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn btn--danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchAdminUsers()
      .then(setUsers)
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner" />
        <p>Loading users…</p>
      </div>
    );
  }

  return (
    <div className="admin-tab-content">
      <div className="admin-toolbar">
        <div className="admin-stat">
          <span className="admin-stat__num">{users.length}</span>
          <span className="admin-stat__label">Total Users</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat__num">
            {users.filter((u) => u.is_admin).length}
          </span>
          <span className="admin-stat__label">Admins</span>
        </div>
        <input
          id="admin-users-search"
          className="admin-search"
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="admin-empty">
          <span>👤</span>
          <p>No users match your search.</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className={u.is_admin ? "admin-table__row--admin" : ""}>
                  <td>
                    <div className="admin-user-cell">
                      <div className="admin-avatar">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{u.name}</span>
                    </div>
                  </td>
                  <td className="admin-table__email">{u.email}</td>
                  <td>
                    {u.is_admin ? (
                      <span className="badge badge--purple">Admin</span>
                    ) : (
                      <span className="badge badge--gray">User</span>
                    )}
                  </td>
                  <td className="admin-table__date">
                    {new Date(u.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Auctions Tab ─────────────────────────────────────────────────────────────
function AuctionsTab() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Auction | null>(null);
  const [deleting, setDeleting] = useState(false);

  const LIMIT = 15;

  const load = useCallback(
    async (pg: number, kw: string, sf: string) => {
      setLoading(true);
      try {
        const data = await fetchAdminAuctions({
          page: pg,
          limit: LIMIT,
          keyword: kw || undefined,
          status: sf || undefined,
        });
        setAuctions(data.items);
        setTotal(data.total);
        setHasMore(data.has_more);
      } catch {
        toast.error("Failed to load auctions");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(page, keyword, statusFilter);
  }, [page, keyword, statusFilter, load]);

  const handleSearch = (kw: string) => {
    setKeyword(kw);
    setPage(1);
  };

  const handleStatusChange = (sf: string) => {
    setStatusFilter(sf);
    setPage(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminDeleteAuction(deleteTarget.id);
      toast.success(`Auction "${deleteTarget.title}" removed.`);
      setDeleteTarget(null);
      load(page, keyword, statusFilter);
    } catch {
      toast.error("Failed to delete auction");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-tab-content">
      {deleteTarget && (
        <ConfirmModal
          title="Delete Auction"
          message={`Permanently remove "${deleteTarget.title}"? This cannot be undone and will delete all bids.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      <div className="admin-toolbar">
        <div className="admin-stat">
          <span className="admin-stat__num">{total}</span>
          <span className="admin-stat__label">Total Auctions</span>
        </div>
        <input
          id="admin-auctions-search"
          className="admin-search"
          type="text"
          placeholder="Search by title or description…"
          value={keyword}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <select
          id="admin-status-filter"
          className="admin-select"
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="admin-loading">
          <div className="spinner" />
          <p>Loading auctions…</p>
        </div>
      ) : auctions.length === 0 ? (
        <div className="admin-empty">
          <span>🔨</span>
          <p>No auctions found.</p>
        </div>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Current Price</th>
                  <th>Bids</th>
                  <th>End Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {auctions.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link
                        to={`/auctions/${a.id}`}
                        className="admin-table__link"
                        target="_blank"
                      >
                        {a.title}
                      </Link>
                    </td>
                    <td>
                      <span className="badge badge--gray">{a.category}</span>
                    </td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="admin-table__price">
                      ₹{Number(a.current_price).toLocaleString("en-IN")}
                    </td>
                    <td>{a.bid_count ?? 0}</td>
                    <td className="admin-table__date">
                      {new Date(a.end_time).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>
                      <button
                        id={`admin-delete-auction-${a.id}`}
                        className="btn btn--danger btn--sm"
                        onClick={() => setDeleteTarget(a)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="admin-pagination">
            <button
              className="btn btn--ghost btn--sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </button>
            <span className="admin-pagination__info">
              Page {page} · {total} total
            </span>
            <button
              className="btn btn--ghost btn--sm"
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main AdminDashboard ──────────────────────────────────────────────────────
type Tab = "users" | "auctions";

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("auctions");

  // Guard: redirect non-admins
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user?.is_admin)) {
      toast.error("Admin access only.");
      navigate("/", { replace: true });
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading || !user?.is_admin) {
    return (
      <div className="admin-loading admin-loading--fullpage">
        <div className="spinner spinner--lg" />
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* ── Header ── */}
      <div className="admin-header">
        <div className="admin-header__icon">🛡️</div>
        <div>
          <h1 className="admin-header__title">Admin Dashboard</h1>
          <p className="admin-header__subtitle">
            Platform oversight — manage users &amp; listings
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="admin-tabs">
        <button
          id="admin-tab-auctions"
          className={`admin-tab-btn ${activeTab === "auctions" ? "admin-tab-btn--active" : ""}`}
          onClick={() => setActiveTab("auctions")}
        >
          🔨 Auctions
        </button>
        <button
          id="admin-tab-users"
          className={`admin-tab-btn ${activeTab === "users" ? "admin-tab-btn--active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          👤 Users
        </button>
      </div>

      {/* ── Tab content ── */}
      {activeTab === "auctions" ? <AuctionsTab /> : <UsersTab />}
    </div>
  );
}
