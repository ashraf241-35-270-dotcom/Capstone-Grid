import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const TEACHER_CARDS = [
  {
    title: 'Sections',
    text: 'Create sections, enroll students and assign capstone projects.',
    status: 'Available',
    to: '/sections'
  },
  {
    title: 'Project tracking',
    text: 'View milestones, tasks, deadlines and progress for assigned students.',
    status: 'Available',
    to: '/projects'
  },
  {
    title: 'Review queue',
    text: 'Review submissions, accept work or request changes.',
    status: 'Available',
    to: '/projects'
  },
  {
    title: 'Marks and feedback',
    text: 'Record feedback, marks and ratings for every project.',
    status: 'Available',
    to: '/projects'
  }
];

const STUDENT_CARDS = [
  {
    title: 'My project',
    text: 'Create a repository for code, reports, descriptions and images.',
    status: 'Available',
    to: '/projects'
  },
  {
    title: 'Project tracking',
    text: 'Manage milestones, tasks, deadlines and completion progress.',
    status: 'Available',
    to: '/projects'
  },
  {
    title: 'Feedback',
    text: 'See supervisor decisions, marks, ratings and comments.',
    status: 'Available',
    to: '/projects'
  }
];

export default function DashboardPage() {
  const { user } = useAuth();
  const cards = user.role === 'Teacher' ? TEACHER_CARDS : STUDENT_CARDS;
  const memberSince = user.createdAt ? String(user.createdAt).slice(0, 10) : 'Today';

  return (
    <>
      <section className="dash-head compact-dash-head">
        <div className="container dash-head-inner">
          <div>
            <span className="eyebrow">Dashboard</span>
            <h1>Hello, {user.name.split(' ')[0]}.</h1>
          </div>
          <div className="role-badge">
            <span className={`pill ${user.role === 'Teacher' ? 'pill-teacher' : 'pill-student'}`}>
              {user.role}
            </span>
            <span className="muted small">{user.department || 'No department set'}</span>
          </div>
        </div>
      </section>

      <section className="section section-tight">
        <div className="container">
          <div className="stat-grid compact-stats">
            <article className="stat-card">
              <span className="stat-label">{user.role === 'Teacher' ? 'Sections' : 'Projects'}</span>
              <strong className="stat-value">0</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Reviews</span>
              <strong className="stat-value">0</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Alerts</span>
              <strong className="stat-value">0</strong>
            </article>
          </div>

          <div className="dash-grid">
            <div className="card">
              <div className="card-head">
                <h2>Workspace</h2>
                <span className="pill pill-soon">Live</span>
              </div>
              <div className="workspace-grid">
                {cards.map((card) => {
                  const content = (
                    <>
                      <div className="workspace-head">
                        <h3>{card.title}</h3>
                        <span className={`pill ${card.status === 'Available' ? 'pill-public' : 'pill-soon'}`}>
                          {card.status}
                        </span>
                      </div>
                      <p className="muted">{card.text}</p>
                    </>
                  );

                  if (card.to) {
                    return (
                      <Link className="workspace-card workspace-card-link" to={card.to} key={card.title}>
                        {content}
                      </Link>
                    );
                  }

                  return (
                    <article className="workspace-card" key={card.title}>
                      {content}
                    </article>
                  );
                })}
              </div>
            </div>

            <aside className="card profile-card">
              <h2>Account</h2>
              <dl className="profile-list">
                <div>
                  <dt>Name</dt>
                  <dd>{user.name}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{user.email}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{user.role}</dd>
                </div>
                <div>
                  <dt>Department</dt>
                  <dd>{user.department || 'Not set'}</dd>
                </div>
                <div>
                  <dt>Member since</dt>
                  <dd>{memberSince}</dd>
                </div>
              </dl>
              <Link className="btn btn-ghost btn-block" to="/">Explore the public grid</Link>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
