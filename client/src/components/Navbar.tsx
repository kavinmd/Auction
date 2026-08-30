import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../api/notifications";
import type { Notification } from "../types";

// ─── Bell Icon SVG ────────────────────────────────────────────────────────────
function BellIcon({ hasUnread }: { hasUnread: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={hasUnread ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

// ─── Format timestamp ─────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Main Navbar ──────────────────────────────────────────────────────────────
export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // ── Fetch notifications ────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch {
      // silent — polling should not spam toasts
    }
  }, [isAuthenticated]);

  // ── Poll every 30 s ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isAuthenticated, fetchNotifications]);

  // ── Close dropdown when clicking outside ─────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Mark a single notification as read ───────────────────────────────────
  const handleMarkRead = async (notification: Notification) => {
    if (notification.is_read) return;
    try {
      const updated = await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === updated.id ? updated : n))
      );
    } catch {
      toast.error("Failed to mark notification as read");
    }
  };

  // ── Mark all as read ──────────────────────────────────────────────────────
  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setLoading(true);
    try {
      await markAllNotificationsRead(notifications);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/login");
    setMenuOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* ── Logo ── */}
        <Link to="/" className="navbar-logo" onClick={() => setMenuOpen(false)}>
          <span className="navbar-logo-icon">🔨</span>
          <span className="navbar-logo-text">AuctionSphere</span>
        </Link>

        {/* ── Desktop links ── */}
        <div className="navbar-links">
          <Link
            to="/auctions"
            className={`navbar-link ${
              isActive("/auctions") || isActive("/") ? "navbar-link--active" : ""
            }`}
          >
            Live Auctions
          </Link>

          {isAuthenticated ? (
            <>
              <Link
                to="/auctions/create"
                className="navbar-btn navbar-btn--primary"
              >
                + Create Auction
              </Link>

              {/* ── Notification Bell ── */}
              <div className="navbar-bell-wrap" ref={bellRef}>
                <button
                  id="navbar-bell-btn"
                  className={`navbar-bell-btn ${bellOpen ? "navbar-bell-btn--active" : ""}`}
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                  onClick={() => {
                    setBellOpen((o) => !o);
                    if (!bellOpen) fetchNotifications();
                  }}
                >
                  <BellIcon hasUnread={unreadCount > 0} />
                  {unreadCount > 0 && (
                    <span className="navbar-bell-badge">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {/* ── Dropdown ── */}
                {bellOpen && (
                  <div className="notif-dropdown" role="dialog" aria-label="Notifications">
                    {/* Header */}
                    <div className="notif-dropdown__header">
                      <span className="notif-dropdown__title">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          className="notif-dropdown__mark-all"
                          onClick={handleMarkAllRead}
                          disabled={loading}
                        >
                          {loading ? "Marking…" : "Mark all read"}
                        </button>
                      )}
                    </div>

                    {/* List */}
                    <div className="notif-dropdown__list">
                      {notifications.length === 0 ? (
                        <div className="notif-dropdown__empty">
                          <span>🔔</span>
                          <p>You're all caught up!</p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            className={`notif-item ${!n.is_read ? "notif-item--unread" : ""}`}
                            onClick={() => handleMarkRead(n)}
                          >
                            {!n.is_read && <span className="notif-item__dot" />}
                            <div className="notif-item__body">
                              <p className="notif-item__msg">{n.message}</p>
                              <span className="notif-item__time">
                                {timeAgo(n.created_at)}
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="navbar-divider" />
              <div className="navbar-user">
                <div className="navbar-avatar">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <span className="navbar-username">{user?.name}</span>
              </div>
              <button
                id="navbar-logout-btn"
                className="navbar-btn navbar-btn--ghost"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                id="navbar-login-link"
                className={`navbar-link ${isActive("/login") ? "navbar-link--active" : ""}`}
              >
                Login
              </Link>
              <Link
                to="/register"
                id="navbar-register-link"
                className="navbar-btn navbar-btn--primary"
              >
                Register
              </Link>
            </>
          )}
        </div>

        {/* ── Mobile hamburger ── */}
        <button
          id="navbar-hamburger"
          className={`navbar-hamburger ${menuOpen ? "navbar-hamburger--open" : ""}`}
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* ── Mobile dropdown ── */}
      <div className={`navbar-mobile-menu ${menuOpen ? "navbar-mobile-menu--open" : ""}`}>
        <Link to="/auctions" className="navbar-mobile-link" onClick={() => setMenuOpen(false)}>
          Live Auctions
        </Link>
        {isAuthenticated ? (
          <>
            <Link
              to="/auctions/create"
              className="navbar-mobile-link navbar-mobile-link--highlight"
              onClick={() => setMenuOpen(false)}
            >
              + Create Auction
            </Link>
            {/* Mobile notification summary */}
            {unreadCount > 0 && (
              <div className="navbar-mobile-link navbar-mobile-notif">
                🔔 {unreadCount} unread notification{unreadCount > 1 ? "s" : ""}
              </div>
            )}
            <div className="navbar-mobile-user">
              <div className="navbar-avatar navbar-avatar--sm">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span>{user?.name}</span>
            </div>
            <button className="navbar-mobile-link navbar-mobile-link--danger" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="navbar-mobile-link" onClick={() => setMenuOpen(false)}>
              Login
            </Link>
            <Link to="/register" className="navbar-mobile-link navbar-mobile-link--highlight" onClick={() => setMenuOpen(false)}>
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
