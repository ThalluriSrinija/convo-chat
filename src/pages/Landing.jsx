import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './Landing.css';

function Landing() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="landing-wrapper">
      {/* Background blobs for depth */}
      <div className="landing-blob landing-blob--1" aria-hidden="true" />
      <div className="landing-blob landing-blob--2" aria-hidden="true" />

      <main className="landing-card">
        {/* Logo mark */}
        <div className="landing-logo" aria-label="Convo logo">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect width="48" height="48" rx="16" fill="url(#logoGrad)" />
            <path
              d="M12 16h24v14a3 3 0 0 1-3 3H18l-6 4v-4a3 3 0 0 1-3-3V16z"
              fill="white"
              fillOpacity="0.9"
            />
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6c63ff" />
                <stop offset="1" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Wordmark */}
        <h1 className="landing-title gradient-text">Convo</h1>

        {/* Tagline */}
        <p className="landing-subtitle">Real-Time One-to-One Chat</p>

        {/* Clickable feature buttons */}
        <div className="landing-badges" role="navigation" aria-label="Feature quick links">
          <Link to="/login" className="landing-badge" title="Sign in to chat instantly">
            ⚡ Instant
          </Link>
          <Link to="/login" className="landing-badge" title="Encrypted private sessions">
            🔒 Private
          </Link>
          <Link to="/register" className="landing-badge" title="Create your free account">
            💬 Simple
          </Link>
        </div>

        {/* Primary Action Buttons */}
        <div className="landing-actions">
          {isAuthenticated ? (
            <Link to="/home" className="btn btn-primary landing-btn-full">
              Open Chats ({user?.name || 'Home'}) →
            </Link>
          ) : (
            <div className="landing-btn-row">
              <Link to="/login" className="btn btn-primary landing-btn">
                Sign In
              </Link>
              <Link to="/register" className="btn btn-secondary landing-btn">
                Create Account
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Landing;
