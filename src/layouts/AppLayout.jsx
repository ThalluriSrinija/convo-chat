import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import './AppLayout.css';

/**
 * AppLayout — wraps the authenticated pages: Home and Chat.
 * Renders the top Navbar and the page content below via <Outlet />.
 */
function AppLayout() {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="app-main" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
