import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { getAuctions } from "../api/auctions";
import type { Auction } from "../types";
import AuctionCard from "../components/AuctionCard";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = [
  "All",
  "Watches",
  "Electronics",
  "Art",
  "Collectibles",
  "Fashion",
  "Vehicles",
  "Jewelry",
  "Other",
];

export default function AuctionList() {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter state
  const [keyword, setKeyword] = useState(searchParams.get("keyword") || "");
  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get("category") || "All"
  );
  const [minPrice, setMinPrice] = useState(searchParams.get("min_price") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("max_price") || "");
  const [endingSoon, setEndingSoon] = useState(
    searchParams.get("ending_soon") === "true"
  );
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1", 10));

  // Data state
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const limit = 12;

  // Sync state to URL and fetch
  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | boolean> = {
        page,
        limit,
      };

      if (keyword.trim()) params.keyword = keyword.trim();
      if (selectedCategory !== "All") params.category = selectedCategory;
      if (minPrice && !isNaN(Number(minPrice))) params.min_price = Number(minPrice);
      if (maxPrice && !isNaN(Number(maxPrice))) params.max_price = Number(maxPrice);
      if (endingSoon) params.ending_soon = true;

      const data = await getAuctions(params);
      setAuctions(data.items);
      setTotal(data.total);
      setTotalPages(Math.max(1, Math.ceil(data.total / limit)));
    } catch (err: any) {
      console.error("Failed to load auctions:", err);
      setError(
        err?.response?.data?.detail || "Failed to load auctions. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [keyword, selectedCategory, minPrice, maxPrice, endingSoon, page]);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  // Update URL search params
  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (keyword.trim()) nextParams.set("keyword", keyword.trim());
    if (selectedCategory !== "All") nextParams.set("category", selectedCategory);
    if (minPrice) nextParams.set("min_price", minPrice);
    if (maxPrice) nextParams.set("max_price", maxPrice);
    if (endingSoon) nextParams.set("ending_soon", "true");
    if (page > 1) nextParams.set("page", String(page));

    setSearchParams(nextParams, { replace: true });
  }, [keyword, selectedCategory, minPrice, maxPrice, endingSoon, page, setSearchParams]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    setPage(1);
  };

  const handleResetFilters = () => {
    setKeyword("");
    setSelectedCategory("All");
    setMinPrice("");
    setMaxPrice("");
    setEndingSoon(false);
    setPage(1);
  };

  const hasActiveFilters =
    keyword.trim() !== "" ||
    selectedCategory !== "All" ||
    minPrice !== "" ||
    maxPrice !== "" ||
    endingSoon;

  return (
    <div className="auction-page-container">
      {/* ── Hero section ── */}
      <section className="auction-hero">
        <div className="auction-hero-content">
          <span className="auction-hero-badge">⚡ Real-Time Bidding Marketplace</span>
          <h1 className="auction-hero-title">
            Discover, Bid & Win <br />
            <span className="auction-hero-title--gradient">Extraordinary Items</span>
          </h1>
          <p className="auction-hero-desc">
            Explore hundreds of live auctions with transparent real-time bidding,
            instant updates, and verified authenticity.
          </p>

          <div className="auction-hero-actions">
            {isAuthenticated ? (
              <Link to="/auctions/create" className="btn btn--primary btn--lg">
                + Create Auction Listing
              </Link>
            ) : (
              <Link to="/register" className="btn btn--primary btn--lg">
                Get Started to Bid & Sell
              </Link>
            )}
            <a href="#browse-section" className="btn btn--ghost btn--lg">
              Browse Listings &darr;
            </a>
          </div>
        </div>

        {/* Decorative glows */}
        <div className="hero-blob hero-blob--1" />
        <div className="hero-blob hero-blob--2" />
      </section>

      {/* ── Main Catalog Section ── */}
      <section id="browse-section" className="catalog-section">
        {/* ── Search & Filter Controls ── */}
        <div className="filter-panel">
          {/* Search bar + Ending Soon toggle */}
          <div className="filter-top-row">
            <form onSubmit={handleSearchSubmit} className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search auctions by title or description..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              {keyword && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => {
                    setKeyword("");
                    setPage(1);
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </form>

            <button
              type="button"
              className={`ending-soon-toggle ${
                endingSoon ? "ending-soon-toggle--active" : ""
              }`}
              onClick={() => {
                setEndingSoon((prev) => !prev);
                setPage(1);
              }}
            >
              🔥 Ending Soon (&lt;1h)
            </button>
          </div>

          {/* Category Pills */}
          <div className="category-pills-row">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`category-pill ${
                  selectedCategory === cat ? "category-pill--active" : ""
                }`}
                onClick={() => handleCategorySelect(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Price Range & Quick Clear */}
          <div className="filter-bottom-row">
            <div className="price-inputs-group">
              <span className="price-label">Price Range (₹):</span>
              <input
                type="number"
                placeholder="Min"
                className="price-filter-input"
                value={minPrice}
                min="0"
                onChange={(e) => {
                  setMinPrice(e.target.value);
                  setPage(1);
                }}
              />
              <span className="price-separator">-</span>
              <input
                type="number"
                placeholder="Max"
                className="price-filter-input"
                value={maxPrice}
                min="0"
                onChange={(e) => {
                  setMaxPrice(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="btn-reset-filters"
                onClick={handleResetFilters}
              >
                ✕ Clear All Filters
              </button>
            )}
          </div>
        </div>

        {/* ── Results Info Bar ── */}
        <div className="catalog-status-bar">
          <span className="catalog-total-count">
            {loading ? "Searching auctions..." : `${total} ${total === 1 ? "auction" : "auctions"} available`}
          </span>
          {hasActiveFilters && (
            <span className="catalog-filtered-tag">Filtered results</span>
          )}
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="error-banner">
            <span>⚠️ {error}</span>
            <button
              onClick={() => fetchAuctions()}
              className="btn btn--ghost btn--sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Auction Grid ── */}
        {loading ? (
          <div className="auction-grid">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="auction-card-skeleton">
                <div className="skeleton-img" />
                <div className="skeleton-body">
                  <div className="skeleton-line skeleton-line--title" />
                  <div className="skeleton-line skeleton-line--sub" />
                  <div className="skeleton-line skeleton-line--btn" />
                </div>
              </div>
            ))}
          </div>
        ) : auctions.length > 0 ? (
          <div className="auction-grid">
            {auctions.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🏷️</div>
            <h3 className="empty-state-title">No Auctions Found</h3>
            <p className="empty-state-desc">
              {hasActiveFilters
                ? "No auctions match your current filters. Try changing or clearing your search criteria."
                : "There are currently no active auctions. Be the first to create one!"}
            </p>
            <div className="empty-state-actions">
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={handleResetFilters}
                >
                  Clear Filters
                </button>
              ) : isAuthenticated ? (
                <Link to="/auctions/create" className="btn btn--primary">
                  + Create First Auction
                </Link>
              ) : null}
            </div>
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && totalPages > 1 && (
          <div className="pagination-wrapper">
            <button
              type="button"
              className="pagination-btn"
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                window.scrollTo({ top: 400, behavior: "smooth" });
              }}
            >
              &larr; Previous
            </button>

            <div className="pagination-pages">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`pagination-page-number ${
                    page === p ? "pagination-page-number--active" : ""
                  }`}
                  onClick={() => {
                    setPage(p);
                    window.scrollTo({ top: 400, behavior: "smooth" });
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="pagination-btn"
              disabled={page >= totalPages}
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 400, behavior: "smooth" });
              }}
            >
              Next &rarr;
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
