import { Link } from 'react-router-dom';
import './NotFound.css';

/**
 * 404 — Not Found page.
 * Shown for any route that doesn't match the defined routes.
 */
function NotFound() {
  return (
    <div className="notfound-wrapper">
      <div className="notfound-blob notfound-blob--1" aria-hidden="true" />
      <div className="notfound-blob notfound-blob--2" aria-hidden="true" />

      <div className="notfound-card">
        <div className="notfound-code" aria-label="Error 404">404</div>
        <h1 className="notfound-title">Page not found</h1>
        <p className="notfound-subtitle">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link to="/" className="btn btn-primary px-4">
          Go to Home
        </Link>
      </div>
    </div>
  );
}

export default NotFound;
