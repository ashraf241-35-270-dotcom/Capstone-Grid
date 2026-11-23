import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { getErrorMessage } from '../api/client.js';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/reset-password', { token, password });
      navigate('/login', { replace: true, state: { message: data.message } });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not reset the password.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <div>
          <span className="eyebrow">Account recovery</span>
          <h2>Choose a new password.</h2>
          <p>The reset link is valid for 30 minutes and can only be used once.</p>
        </div>
      </aside>
      <div className="auth-main">
        <div className="auth-card">
          <header className="auth-header">
            <h1>Reset password</h1>
            <p className="muted">Use a password with at least 8 characters.</p>
          </header>
          {!token && (
            <div className="alert alert-error" role="alert">
              This reset link is missing its token. Request a new link to continue.
            </div>
          )}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <form onSubmit={handleSubmit}>
            <label className="field">
              <span className="field-label">New password</span>
              <input
                type="password"
                name="new-password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Confirm new password</span>
              <input
                type="password"
                name="confirm-password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </label>
            <button
              className="btn btn-primary btn-block"
              type="submit"
              disabled={submitting || !token}
            >
              {submitting ? 'Updating...' : 'Update password'}
            </button>
          </form>
          <p className="auth-switch"><Link to="/login">Back to log in</Link></p>
        </div>
      </div>
    </div>
  );
}
