import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { createAuction } from "../api/auctions";

const CATEGORIES = [
  "Watches",
  "Electronics",
  "Art",
  "Collectibles",
  "Fashion",
  "Vehicles",
  "Jewelry",
  "Other",
];

interface ImagePreview {
  file: File;
  previewUrl: string;
}

export default function CreateAuction() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Watches");
  const [description, setDescription] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [endTime, setEndTime] = useState(() => {
    // Default to 7 days from now
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm format for datetime-local
  });

  // Images state
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Duration Presets
  const handleSetPresetDuration = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setEndTime(d.toISOString().slice(0, 16));
  };

  // Image handling
  const handleImageFiles = (files: FileList | null) => {
    if (!files) return;

    const newFiles = Array.from(files);
    if (images.length + newFiles.length > 5) {
      toast.error("You can upload a maximum of 5 images.");
      return;
    }

    const validPreviews: ImagePreview[] = [];
    for (const file of newFiles) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not a valid image.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 10 MB limit.`);
        continue;
      }
      validPreviews.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    setImages((prev) => [...prev, ...validPreviews]);
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[indexToRemove].previewUrl);
      return prev.filter((_, idx) => idx !== indexToRemove);
    });
  };

  const validate = () => {
    const errs: Record<string, string> = {};

    if (!title.trim() || title.length < 3) {
      errs.title = "Title must be at least 3 characters.";
    }
    if (!description.trim() || description.length < 10) {
      errs.description = "Description must be at least 10 characters.";
    }
    if (!startingPrice || Number(startingPrice) <= 0) {
      errs.startingPrice = "Starting price must be greater than ₹0.";
    }

    const selectedDate = new Date(endTime);
    if (isNaN(selectedDate.getTime()) || selectedDate <= new Date()) {
      errs.endTime = "End time must be a date and time in the future.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please correct the errors in the form.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("category", category);
      formData.append("description", description.trim());
      formData.append("starting_price", startingPrice);

      // Convert datetime-local to ISO string
      const isoEndTime = new Date(endTime).toISOString();
      formData.append("end_time", isoEndTime);

      // Append image files
      images.forEach((img) => {
        formData.append("images", img.file);
      });

      const newAuction = await createAuction(formData);
      toast.success("Auction listing created successfully!");
      navigate(`/auctions/${newAuction.id}`);
    } catch (err: any) {
      console.error("Failed to create auction:", err);
      toast.error(
        err?.response?.data?.detail || "Failed to create auction. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-auction-page">
      <div className="create-auction-container">
        {/* ── Breadcrumb / Header ── */}
        <div className="create-header">
          <Link to="/auctions" className="back-link">
            &larr; Back to Listings
          </Link>
          <h1 className="create-title">Create New Auction Listing</h1>
          <p className="create-subtitle">
            Fill in the details below to list your item on the AuctionSphere real-time marketplace.
          </p>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="create-form">
          {/* Card: Basic Details */}
          <div className="create-card">
            <h2 className="create-section-title">📦 Item Information</h2>

            {/* Title */}
            <div className="form-group">
              <label className="form-label" htmlFor="auction-title">
                Listing Title *
              </label>
              <input
                id="auction-title"
                type="text"
                className={`form-input ${errors.title ? "form-input--error" : ""}`}
                placeholder="e.g. 1968 Vintage Omega Speedmaster Chronograph"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
                required
              />
              {errors.title && <span className="form-error-msg">{errors.title}</span>}
            </div>

            {/* Category & Starting Price */}
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label" htmlFor="auction-category">
                  Category *
                </label>
                <select
                  id="auction-category"
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="auction-price">
                  Starting Price (₹ INR) *
                </label>
                <div className="form-input-currency-wrapper">
                  <span className="currency-symbol">₹</span>
                  <input
                    id="auction-price"
                    type="number"
                    step="1"
                    min="1"
                    className={`form-input form-input--currency ${
                      errors.startingPrice ? "form-input--error" : ""
                    }`}
                    placeholder="1000"
                    value={startingPrice}
                    onChange={(e) => setStartingPrice(e.target.value)}
                    required
                  />
                </div>
                {errors.startingPrice && (
                  <span className="form-error-msg">{errors.startingPrice}</span>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label" htmlFor="auction-desc">
                Item Description *
              </label>
              <textarea
                id="auction-desc"
                className={`form-textarea ${
                  errors.description ? "form-input--error" : ""
                }`}
                rows={5}
                placeholder="Describe condition, specifications, provenance, authenticity, and included accessories in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
              {errors.description && (
                <span className="form-error-msg">{errors.description}</span>
              )}
            </div>
          </div>

          {/* Card: Duration & End Time */}
          <div className="create-card">
            <h2 className="create-section-title">⏳ Auction Duration</h2>
            <p className="create-section-desc">
              Select how long your auction will accept bids before closing automatically.
            </p>

            {/* Quick Duration Presets */}
            <div className="duration-presets">
              <span className="presets-label">Quick Presets:</span>
              <button
                type="button"
                className="preset-btn"
                onClick={() => handleSetPresetDuration(1)}
              >
                +24 Hours
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => handleSetPresetDuration(3)}
              >
                +3 Days
              </button>
              <button
                type="button"
                className="preset-btn preset-btn--active"
                onClick={() => handleSetPresetDuration(7)}
              >
                +7 Days (Recommended)
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => handleSetPresetDuration(14)}
              >
                +14 Days
              </button>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="auction-endtime">
                End Date & Time (UTC/Local) *
              </label>
              <input
                id="auction-endtime"
                type="datetime-local"
                className={`form-input ${errors.endTime ? "form-input--error" : ""}`}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
              {errors.endTime && (
                <span className="form-error-msg">{errors.endTime}</span>
              )}
            </div>
          </div>

          {/* Card: Images */}
          <div className="create-card">
            <h2 className="create-section-title">📸 Item Images (Up to 5)</h2>
            <p className="create-section-desc">
              High quality images increase bids. The first image will be used as the primary thumbnail.
            </p>

            {/* Dropzone */}
            <div
              className="image-dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden-file-input"
                onChange={(e) => handleImageFiles(e.target.files)}
              />
              <span className="dropzone-icon">🖼️</span>
              <span className="dropzone-title">
                Click or drag & drop images here
              </span>
              <span className="dropzone-hint">
                PNG, JPG, WEBP up to 10 MB each ({images.length}/5 selected)
              </span>
            </div>

            {/* Image Preview Grid */}
            {images.length > 0 && (
              <div className="image-previews-grid">
                {images.map((img, idx) => (
                  <div key={idx} className="preview-card">
                    <img src={img.previewUrl} alt={`Upload preview ${idx + 1}`} />
                    <span className="preview-index-tag">
                      {idx === 0 ? "★ Primary" : `#${idx + 1}`}
                    </span>
                    <button
                      type="button"
                      className="preview-remove-btn"
                      onClick={() => handleRemoveImage(idx)}
                      title="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Submit Action Row ── */}
          <div className="create-submit-row">
            <Link to="/auctions" className="btn btn--ghost btn--lg">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn--primary btn--lg create-submit-btn"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="btn-spinner" />
                  <span>Uploading & Listing...</span>
                </>
              ) : (
                <>
                  <span>🚀 Publish Live Auction</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
