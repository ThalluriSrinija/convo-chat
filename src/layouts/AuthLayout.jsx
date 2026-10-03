import { Outlet, Link } from 'react-router-dom';
import './AuthLayout.css';

/**
 * AuthLayout — wraps Login, Register, ForgotPassword pages.
 * Provides the centered card shell with a subtle branded background.
 * The actual form content is rendered via <Outlet />.
 */
function AuthLayout() {
  return (
    <div className="auth-layout">
      {/* Ambient background blobs */}
      <div className="auth-blob auth-blob--1" aria-hidden="true" />
      <div className="auth-blob auth-blob--2" aria-hidden="true" />

      <div className="auth-container">
        {/* Brand link at top */}
        <Link to="/" className="auth-brand" aria-label="Go to Convo home">
          <svg
            width="32"
            height="32"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect width="48" height="48" rx="14" fill="url(#authLogoGrad)" />
            <path
              d="M12 16h24v14a3 3 0 0 1-3 3H18l-6 4v-4a3 3 0 0 1-3-3V16z"
              fill="white"
              fillOpacity="0.9"
            />
            <defs>
              <linearGradient id="authLogoGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6c63ff" />
                <stop offset="1" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
          <span className="auth-brand__name gradient-text">Convo</span>
        </Link>

        {/* Card shell — page content goes here */}
        <div className="auth-card">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
