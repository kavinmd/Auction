import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Pages (will be added as each day's work is done)
// import Login from "./pages/Login";
// import Register from "./pages/Register";
// import AuctionList from "./pages/AuctionList";
// import AuctionDetail from "./pages/AuctionDetail";
// import CreateAuction from "./pages/CreateAuction";
// import BuyerDashboard from "./pages/BuyerDashboard";
// import SellerDashboard from "./pages/SellerDashboard";
// import AdminDashboard from "./pages/AdminDashboard";

// Context
// import { AuthProvider } from "./context/AuthContext";

function App() {
  return (
    // <AuthProvider>
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
            },
            success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
          }}
        />

        <Routes>
          {/* Placeholder home route — real routes added in Day 4+ */}
          <Route
            path="/"
            element={
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100vh",
                  gap: "12px",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <h1 style={{ fontSize: "2.5rem", fontWeight: 800, color: "#6366f1" }}>
                  AuctionSphere
                </h1>
                <p style={{ color: "#9ca3af", fontSize: "1.1rem" }}>
                  🚀 Day 1 scaffold complete — backend + frontend running!
                </p>
                <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                  API Docs:{" "}
                  <a href="http://localhost:8000/docs" style={{ color: "#6366f1" }}>
                    http://localhost:8000/docs
                  </a>
                </p>
              </div>
            }
          />
          {/* Routes will be added here as features are built */}
        </Routes>
      </BrowserRouter>
    // </AuthProvider>
  );
}

export default App;
