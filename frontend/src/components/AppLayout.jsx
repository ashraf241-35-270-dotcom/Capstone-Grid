import { Outlet } from 'react-router-dom';
import Navbar from './Navbar.jsx';

export default function AppLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <span>Capstone Grid</span>
          <span>Centralized capstone submissions, reviews and archive.</span>
        </div>
      </footer>
    </div>
  );
}
