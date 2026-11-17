import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import RoleSelect from '../components/RoleSelect.jsx';

export default function RegisterPage() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('Student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [departmentsError, setDepartmentsError] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get('/departments')
      .then(({ data }) => {
        if (active) setDepartments(data.departments);
      })
      .catch(() => {
        if (active) setDepartmentsError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="page-loader">
        <span className="spinner" aria-hidden="true" />
        Loading...
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        departmentId: departmentId ? Number(departmentId) : null
      });
      navigate('/login', {
        state: {
          message: 'Account created successfully. Log in to continue.',
          email: email.trim()
        }
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create the account. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <div>
          <span className="eyebrow">Join Capstone Grid</span>
          <h2>One account for the whole capstone journey.</h2>
          <p>
            Students keep their work organized. Teachers review, guide and grade. Everyone can
            explore what the university is building.
          </p>
        </div>
        <ul className="auth-list">
          <li>Students: create and submit projects</li>
          <li>Teachers: manage sections and reviews</li>
          <li>Everyone: explore public capstones</li>
        </ul>
      </aside>

      <div className="auth-main">
        <div className="auth-card auth-card-wide">
          <header className="auth-header">
            <h1>Create your account</h1>
            <p className="muted">Choose your role and fill in your details.</p>
          </header>

          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {departmentsError && (
            <div className="alert alert-warning" role="status">
              Departments could not be loaded. You can still register and add one later.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <RoleSelect value={role} onChange={setRole} />

            <label className="field">
              <span className="field-label">Full name</span>
              <input
                type="text"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Full name"
                minLength={2}
                maxLength={120}
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Email address</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@university.edu"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Department</span>
              <select
                name="departmentId"
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
              >
                <option value="">Select a department (optional)</option>
                {departments.map((department) => (
                  <option key={department.department_id} value={department.department_id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="field-row">
              <label className="field">
                <span className="field-label">Password</span>
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </label>

              <label className="field">
                <span className="field-label">Confirm password</span>
                <input
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat your password"
                  minLength={8}
                  required
                />
              </label>
            </div>

            <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
              {submitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
