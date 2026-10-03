import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { logoutUser } from '../api/authApi.js';
import './Navbar.css';

/**
 * Navbar — top navigation bar for all authenticated pages.
 *
 * Shows: Convo logo | current user name + avatar | logout button
 *
 * Search is handled within each page's own section header
 * so it's contextually scoped (Home page = user search, Chat = message search, etc.)
 */
function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initial     = user?.name?.[0]?.toUpperCase() ?? '?';
  const displayName = user?.name ?? 'User';

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // Expected until backend connected — proceed anyway
    } finally {
      logout();
      navigate('/login');
    }
  };

  return (
    <header className="navbar-convo" role="banner">
      <nav className="navbar-inner container-fluid" aria-label="Main navigation">

        {/* Brand */}
        <Link to="/home" className="navbar-brand-link" aria-label="Convo — go to home">
          <svg
            className="navbar-logo-icon"
            width="28" height="28" viewBox="0 0 48 48" fill="none"
            xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
          >
            <rect width="48" height="48" rx="14" fill="url(#navLogoGrad)" />
            <path
              d="M12 16h24v14a3 3 0 0 1-3 3H18l-6 4v-4a3 3 0 0 1-3-3V16z"
              fill="white" fillOpacity="0.9"
            />
            <defs>
              <linearGradient id="navLogoGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6c63ff" />
                <stop offset="1" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
          <span className="navbar-brand-name gradient-text">Convo</span>
        </Link>

        {/* Right side: user info + logout */}
        <div className="navbar-actions">
          {/* User name + avatar */}
          <div className="navbar-user">
            <div
              className="navbar-avatar"
              aria-label={`Logged in as ${displayName}`}
              title={displayName}
            >
              <span aria-hidden="true">{initial}</span>
            </div>
            <span className="navbar-user-name">{displayName}</span>
          </div>

          {/* Logout */}
          <button
            className="navbar-logout-btn"
            aria-label="Log out"
            title="Log out"
            onClick={handleLogout}
          >
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
