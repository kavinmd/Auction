import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Context
import { AuthProvider } from "./context/AuthContext";

// Components
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import Login from "./pages/Login";
import Register from "./pages/Register";

// ── Placeholder home page (will be replaced in Day 6 with AuctionList) ──────
function HomePage() {
  return (
    <div className="home-hero">
      <div className="home-hero-content">
        <div className="home-hero-badge">🔨 Live Auctions</div>
        <h1 className="home-hero-title">
          Bid Smart,<br />
          <span className="home-hero-title--accent">Win Big</span>
        </h1>
        <p className="home-hero-subtitle">
          AuctionSphere is the premier real-time auction platform. Discover unique
          items, place live bids, and never miss a deal — all with instant WebSocket
          updates.
        </p>
        <div className="home-hero-actions">
          <a href="/register" className="btn btn--primary btn--lg">
            Get Started Free
          </a>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="btn btn--ghost btn--lg"
          >
            API Docs ↗
          </a>
        </div>

        {/* Feature chips */}
        <div className="home-features">
          {[
            { icon: "⚡", label: "Real-time bidding" },
            { icon: "🔒", label: "Secure payments" },
            { icon: "🌍", label: "Global marketplace" },
            { icon: "📱", label: "Mobile friendly" },
          ].map(({ icon, label }) => (
            <div key={label} className="home-feature-chip">
              <span>{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Decorative glow blobs */}
      <div className="hero-blob hero-blob--1" />
      <div className="hero-blob hero-blob--2" />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Global toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1f2937",
              color: "#f9fafb",
              border: "1px solid #374151",
              borderRadius: "8px",
              fontFamily: "Inter, sans-serif",
            },
            success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
          }}
        />

        <Navbar />

        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Future protected routes — uncomment as features are built */}
            {/* 
            <Route
              path="/auctions"
              element={
                <ProtectedRoute>
                  <AuctionList />
                </ProtectedRoute>
              }
            />
            */}

            {/* 404 fallback */}
            <Route
              path="*"
              element={
                <div className="not-found">
                  <h2>404 — Page not found</h2>
                  <a href="/" className="btn btn--primary">Go Home</a>
                </div>
              }
            />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}

// Keep ProtectedRoute in scope for future imports (suppress unused lint)
void ProtectedRoute;

export default App;
