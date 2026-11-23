import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../api/client.js';
import RoleSelect from '../components/RoleSelect.jsx';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [role, setRole] = useState('Student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="page-loader">
        <span className="spinner" aria-hidden="true" />
        Checking your session...
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password, role });
      setEmail('');
      setPassword('');
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not log in. Please try again.'));
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <div>
          <span className="eyebrow">Welcome back</span>
          <h2>Your capstone work is waiting.</h2>
          <p>
            Pick up your project, review submissions or check the latest feedback from your
            supervisor.
          </p>
        </div>
        <ul className="auth-list">
          <li>Private project repositories</li>
          <li>Structured feedback, marks and ratings</li>
          <li>Milestones and deadline tracking</li>
        </ul>
      </aside>

      <div className="auth-main">
        <div className="auth-card">
          <header className="auth-header">
            <h1>Log in to Capstone Grid</h1>
            <p className="muted">Use the account type that matches your role.</p>
          </header>

          {location.state?.message && (
            <div className="alert alert-success" role="status">{location.state.message}</div>
          )}
          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit} noValidate autoComplete="off">
            <RoleSelect value={role} onChange={setRole} />

            <label className="field">
              <span className="field-label">Email address</span>
              <input
                type="email"
                name="login-email-entry"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Example: you@university.edu"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Password</span>
              <input
                type="password"
                name="login-password-entry"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
              />
            </label>

            <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
              {submitting ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          <p className="auth-switch">
            New to Capstone Grid? <Link to="/register">Create an account</Link>
          </p>
          <p className="auth-switch">
            <Link to="/forgot-password">Forgot your password?</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
