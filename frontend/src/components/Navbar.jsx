import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function initialsOf(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || '')
      .join('')
      .toUpperCase() || '?'
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="brand" aria-label="Capstone Grid home">
          <span className="brand-mark">CG</span>
          <span className="brand-text">Capstone Grid</span>
        </Link>

        <nav className="nav-links" aria-label="Main navigation">
          <Link to="/">Explore</Link>
          {user && <Link to="/dashboard">Dashboard</Link>}
          {user && <Link to="/sections">Sections</Link>}
          {user?.role === 'Student' && <Link to="/projects">Projects</Link>}
          {user?.role === 'Teacher' && <Link to="/projects">Project tracking</Link>}
        </nav>

        <div className="nav-actions">
          {user ? (
            <>
              <div className="user-chip">
                <span className="avatar" aria-hidden="true">{initialsOf(user.name)}</span>
                <span className="user-meta">
                  <strong>{user.name}</strong>
                  <small>{user.role}</small>
                </span>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm" to="/login">Log in</Link>
              <Link className="btn btn-primary btn-sm" to="/register">Create account</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
