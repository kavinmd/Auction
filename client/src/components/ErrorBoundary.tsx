import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — catches unexpected runtime errors anywhere in the React tree
 * and renders a friendly fallback UI instead of a blank screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // In production you'd send this to an error reporting service (e.g. Sentry)
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="error-boundary-container" role="alert">
          <div className="error-boundary-card">
            <div className="error-boundary-icon">⚡</div>
            <h1 className="error-boundary-title">Something went wrong</h1>
            <p className="error-boundary-desc">
              An unexpected error occurred. Our team has been notified.
              You can try refreshing the page or returning to the home page.
            </p>

            {this.state.error && (
              <details className="error-boundary-details">
                <summary>Technical details</summary>
                <pre className="error-boundary-pre">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}

            <div className="error-boundary-actions">
              <button
                id="error-boundary-reload-btn"
                className="btn btn--primary"
                onClick={() => window.location.reload()}
              >
                🔄 Reload Page
              </button>
              <button
                id="error-boundary-home-btn"
                className="btn btn--ghost"
                onClick={this.handleReset}
              >
                ← Go to Home
              </button>
            </div>
          </div>

          {/* Decorative blobs */}
          <div className="hero-blob hero-blob--1" style={{ opacity: 0.15 }} />
          <div className="hero-blob hero-blob--2" style={{ opacity: 0.1 }} />
        </div>
      );
    }

    return this.props.children;
  }
}
