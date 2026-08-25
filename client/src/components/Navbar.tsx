import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

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
            to="/"
            className={`navbar-link ${isActive("/") ? "navbar-link--active" : ""}`}
          >
            Home
          </Link>

          {isAuthenticated ? (
            <>
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
        <Link to="/" className="navbar-mobile-link" onClick={() => setMenuOpen(false)}>
          Home
        </Link>
        {isAuthenticated ? (
          <>
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
