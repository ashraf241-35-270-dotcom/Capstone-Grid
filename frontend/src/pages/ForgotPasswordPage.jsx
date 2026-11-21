import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../api/client.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.trim() });
      setMessage(data.message);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not request a password reset.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <div>
          <span className="eyebrow">Account recovery</span>
          <h2>Get back to your capstone work.</h2>
          <p>We will email a one-time link if an account matches the address.</p>
        </div>
      </aside>
      <div className="auth-main">
        <div className="auth-card">
          <header className="auth-header">
            <h1>Forgot your password?</h1>
            <p className="muted">Enter the email address associated with your account.</p>
          </header>
          {message && <div className="alert alert-success" role="status">{message}</div>}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <form onSubmit={handleSubmit}>
            <label className="field">
              <span className="field-label">Email address</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                maxLength={190}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@university.edu"
                required
              />
            </label>
            <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
          <p className="auth-switch"><Link to="/login">Back to log in</Link></p>
        </div>
      </div>
    </div>
  );
}
