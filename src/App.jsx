import { Routes, Route } from 'react-router-dom';

// Layouts
import AuthLayout    from './layouts/AuthLayout.jsx';
import AppLayout     from './layouts/AppLayout.jsx';

// Route guards
import ProtectedRoute from './routes/ProtectedRoute.jsx'; // /home, /chat/*
import PublicRoute    from './routes/PublicRoute.jsx';    // /login, /register, /forgot-password

// Auth pages
import Login          from './pages/Login.jsx';
import Register       from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';

// App pages
import Home           from './pages/Home.jsx';
import Chat           from './pages/Chat.jsx';

// Landing & 404
import Landing        from './pages/Landing.jsx';
import NotFound       from './pages/NotFound.jsx';

/**
 * App — root router.
 *
 * Route guard behaviour:
 *
 *   PublicRoute  → unauthenticated: renders page
 *                → authenticated:   redirects to /home
 *                → loading:         shows LoadingScreen
 *
 *   ProtectedRoute → authenticated:   renders page
 *                  → unauthenticated: redirects to /login
 *                  → loading:         shows LoadingScreen
 *
 * Full route tree:
 *
 *   /                    Landing          (public, no guard)
 *   /login               Login            (PublicRoute + AuthLayout)
 *   /register            Register         (PublicRoute + AuthLayout)
 *   /forgot-password     ForgotPassword   (PublicRoute + AuthLayout)
 *   /home                Home             (ProtectedRoute + AppLayout)
 *   /chat/:id            Chat             (ProtectedRoute + AppLayout)
 *   *                    NotFound         (no guard)
 */
function App() {
  return (
    <Routes>
      {/* ── Landing ─────────────────────────────────────────── */}
      <Route path="/" element={<Landing />} />

      {/* ── Public auth pages ───────────────────────────────── */}
      {/* Authenticated users hitting these routes → /home     */}
      <Route element={<PublicRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login"           element={<Login />} />
          <Route path="/register"        element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>
      </Route>

      {/* ── Protected app pages ─────────────────────────────── */}
      {/* Unauthenticated users hitting these routes → /login  */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/home"                 element={<Home />} />
          <Route path="/chat/:conversationId" element={<Chat />} />
        </Route>
      </Route>

      {/* ── 404 ─────────────────────────────────────────────── */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
