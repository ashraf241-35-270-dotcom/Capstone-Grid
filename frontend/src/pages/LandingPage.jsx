import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import CommunityFeed from '../components/CommunityFeed.jsx';

const FEATURES = [
  { title: 'Sections', text: 'Create and manage teaching groups.' },
  { title: 'Projects', text: 'Store code, files and submissions.' },
  { title: 'Reviews', text: 'Track feedback and decisions.' }
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">Capstone Grid</span>
            <h1>One place for capstone work.</h1>
            <p className="hero-lead">
              Manage projects, sections, submissions and feedback in one minimal workspace.
            </p>
            <div className="hero-actions">
              {user ? (
                <Link className="btn btn-accent" to="/dashboard">Dashboard</Link>
              ) : (
                <>
                  <Link className="btn btn-accent" to="/register">Create account</Link>
                  <Link className="btn btn-outline" to="/login">Log in</Link>
                </>
              )}
            </div>
            <ul className="hero-points compact">
              <li>Students</li>
              <li>Teachers</li>
              <li>Projects</li>
            </ul>
          </div>

          <div className="hero-panel minimal-panel" aria-hidden="true">
            <div className="mock-card mock-main">
              <span className="mock-kicker">Project</span>
              <strong>Campus Assistant</strong>
              <div className="mock-bar"><span style={{ width: '74%' }} /></div>
              <div className="mock-row">
                <span className="pill pill-public">Public</span>
                <span className="pill pill-progress">Review</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section compact-section">
        <div className="container">
          <div className="feature-grid compact-grid">
            {FEATURES.map((feature) => (
              <article className="feature-card compact-card" key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <CommunityFeed user={user} />
    </>
  );
}
