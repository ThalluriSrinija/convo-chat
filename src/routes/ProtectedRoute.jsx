import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';

/**
 * ProtectedRoute — guards authenticated pages: /home, /chat/:conversationId
 *
 * Decision tree (in order):
 *
 *   1. isLoading  → show <LoadingScreen /> while session is being restored
 *                   from sessionStorage on first mount.
 *                   Prevents a flash-redirect to /login before auth state is known.
 *
 *   2. isAuthenticated → render <Outlet /> (the nested page + its layout)
 *
 *   3. !isAuthenticated → <Navigate to="/login" replace />
 *                         Unauthenticated users cannot access protected pages.
 *
 * Backend note:
 *   AuthProvider restores sessions via GET /auth/me (JWT validation), not sessionStorage alone.
 *   All protected API endpoints enforce authentication server-side.
 */
function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  // 1. Auth state is still being read from sessionStorage — show loading screen
  if (isLoading) {
    return <LoadingScreen />;
  }

  // 2. Unauthenticated — send to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 3. Authenticated — render the requested page
  return <Outlet />;
}

export default ProtectedRoute;
