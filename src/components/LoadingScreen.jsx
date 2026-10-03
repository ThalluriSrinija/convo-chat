import './LoadingScreen.css';

/**
 * LoadingScreen — full-viewport spinner shown while AuthContext
 * is restoring the session from sessionStorage on app mount.
 *
 * Displayed for a very brief moment (< 50 ms in most cases).
 * Prevents a flash of the login redirect before auth state is known.
 */
function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-label="Loading Convo…">
      <div className="loading-screen__inner">
        {/* Animated logo mark */}
        <div className="loading-logo" aria-hidden="true">
          <svg
            width="44"
            height="44"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="48" height="48" rx="14" fill="url(#loadGrad)" />
            <path
              d="M12 16h24v14a3 3 0 0 1-3 3H18l-6 4v-4a3 3 0 0 1-3-3V16z"
              fill="white"
              fillOpacity="0.9"
            />
            <defs>
              <linearGradient id="loadGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6c63ff" />
                <stop offset="1" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Pulse dots */}
        <div className="loading-dots" aria-hidden="true">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </div>

        <p className="loading-label">Loading Convo…</p>
      </div>
    </div>
  );
}

export default LoadingScreen;
