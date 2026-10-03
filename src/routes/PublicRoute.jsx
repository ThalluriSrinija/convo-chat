import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';

/**
 * PublicRoute — guards public auth pages: /login, /register, /forgot-password
 *
 * Prevents an already-authenticated user from seeing the login or register
 * screen — they are automatically redirected to /home instead.
 *
 * Decision tree (in order):
 *
 *   1. isLoading       → show <LoadingScreen /> while session is restored.
 *                        Without this, an authenticated user would briefly
 *                        see the login form before being redirected.
 *
 *   2. isAuthenticated → <Navigate to="/home" replace />
 *                        Logged-in users have no reason to be on auth pages.
 *
 *   3. !isAuthenticated → render <Outlet /> (Login / Register / ForgotPassword)
 *
 * Symmetric to ProtectedRoute — together they form a complete auth guard pair.
 */
function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  // 1. Wait for session restoration
  if (isLoading) {
    return <LoadingScreen />;
  }

  // 2. Already logged in — go to app
  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  // 3. Not logged in — show the public page
  return <Outlet />;
}

export default PublicRoute;
