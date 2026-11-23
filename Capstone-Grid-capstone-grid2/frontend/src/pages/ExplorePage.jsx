import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import CommunityFeed from '../components/CommunityFeed.jsx';
import ReviewScoreSummary from '../components/ReviewScoreSummary.jsx';

const EMPTY_FILTERS = {
  search: '',
  studentId: '',
  teacherId: '',
  categoryId: '',
  departmentId: '',
  status: ''
};

function ProjectCard({ project }) {
  return (
    <article className="explore-card">
      <div className="explore-card-top">
        <span className={`pill ${project.status === 'Archived' ? 'pill-soon' : 'pill-public'}`}>
          {project.status === 'Archived' ? 'Archive' : 'Accepted'}
        </span>
        <span className="muted small">
          {project.status === 'Archived' && project.archivedAt
            ? `Archived ${String(project.archivedAt).slice(0, 10)}`
            : `Created ${String(project.createdAt).slice(0, 10)}`}
        </span>
      </div>
      <h2>{project.title}</h2>
      <p className="explore-description">{project.description}</p>
      <dl className="explore-details">
        <div><dt>Student</dt><dd>{project.studentName || 'Not listed'}</dd></div>
        <div><dt>Supervisor</dt><dd>{project.teacherName || 'Not listed'}</dd></div>
        <div><dt>Category</dt><dd>{project.categoryName || 'Uncategorized'}</dd></div>
        <div><dt>Department</dt><dd>{project.departmentName || 'Not listed'}</dd></div>
      </dl>
      {project.reviewSummary && (
        <ReviewScoreSummary
          marks={project.reviewSummary.marks}
          rating={project.reviewSummary.rating}
        />
      )}
      {project.status === 'Archived' && project.files.length > 0 && (
        <section className="archive-files" aria-label="Archived project files">
          <h3>Project files</h3>
          <ul>
            {project.files.map((file) => (
              <li key={file.fileId}>
                <a href={api.getUri({ url: file.downloadUrl })}>
                  {file.name}
                </a>
                <span className="muted small">
                  {`${(file.size / (1024 * 1024)).toFixed(2)} MB`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

export default function ExplorePage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('projects');
  const [form, setForm] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterOptions, setFilterOptions] = useState({
    students: [],
    teachers: [],
    categories: [],
    departments: []
  });
  const [projects, setProjects] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageCount: 0, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeSection !== 'projects') return undefined;
    let active = true;

    async function loadProjects() {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ page: String(page) });
      Object.entries(filters).forEach(([name, value]) => {
        if (value) params.set(name, value);
      });

      try {
        const { data } = await api.get(`/projects/explore?${params.toString()}`);
        if (!active) return;
        setProjects(data.projects || []);
        setFilterOptions(data.filters || {
          students: [],
          teachers: [],
          categories: [],
          departments: []
        });
        setPagination(data.pagination || { page: 1, pageCount: 0, total: 0 });
      } catch (err) {
        if (active) setError(getErrorMessage(err, 'Could not load public projects.'));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProjects();
    return () => { active = false; };
  }, [activeSection, filters, page]);

  function updateForm(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    setFilters({ ...form, search: form.search.trim() });
  }

  function clearSearch() {
    setForm(EMPTY_FILTERS);
    setPage(1);
    setFilters(EMPTY_FILTERS);
  }

  return (
    <>
      <section className="page-head">
        <div className="container page-head-inner">
          <div>
            <span className="eyebrow eyebrow-dark">Public showcase</span>
            <h1>Explore Capstone Grid</h1>
            <p className="muted">Browse public projects or join the community conversation.</p>
          </div>
          {activeSection === 'projects' && (
            <span className="pill pill-public">
              {pagination.total} project{pagination.total === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </section>

      <section className="section section-tight">
        <div className="container">
          <div className="explore-section-options" role="group" aria-label="Explore sections">
            <button
              className="explore-section-button"
              type="button"
              aria-pressed={activeSection === 'projects'}
              onClick={() => setActiveSection('projects')}
            >
              <span>Public projects</span>
              <span>Accepted work and archive</span>
            </button>
            <button
              className="explore-section-button"
              type="button"
              aria-pressed={activeSection === 'posts'}
              onClick={() => setActiveSection('posts')}
            >
              <span>Community posts</span>
              <span>Posts and public opinions</span>
            </button>
          </div>
        </div>
      </section>

      {activeSection === 'projects' ? (
      <section className="section section-tight explore-content">
        <div className="container explore-layout">
          <form className="card explore-filters" onSubmit={handleSearch}>
            <h2>Search and filter</h2>
            <label className="field">
              <span className="field-label">Project name or description</span>
              <input
                type="search"
                maxLength={120}
                value={form.search}
                onChange={(event) => updateForm('search', event.target.value)}
                placeholder="Search projects"
              />
            </label>
            <label className="field">
              <span className="field-label">Student</span>
              <select value={form.studentId} onChange={(event) => updateForm('studentId', event.target.value)}>
                <option value="">All students</option>
                {filterOptions.students.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Teacher</span>
              <select value={form.teacherId} onChange={(event) => updateForm('teacherId', event.target.value)}>
                <option value="">All teachers</option>
                {filterOptions.teachers.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Category</span>
              <select value={form.categoryId} onChange={(event) => updateForm('categoryId', event.target.value)}>
                <option value="">All categories</option>
                {filterOptions.categories.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Department</span>
              <select value={form.departmentId} onChange={(event) => updateForm('departmentId', event.target.value)}>
                <option value="">All departments</option>
                {filterOptions.departments.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Project status</span>
              <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                <option value="">Accepted and archived</option>
                <option value="Accepted">Accepted projects</option>
                <option value="Archived">Archive</option>
              </select>
            </label>
            <div className="explore-filter-actions">
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Searching...' : 'Apply filters'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={clearSearch} disabled={loading}>
                Clear
              </button>
            </div>
          </form>

          <div className="explore-results">
            <div className="list-head">
              <h2>Public projects</h2>
              {!loading && (
                <span className="muted small">
                  {pagination.total} result{pagination.total === 1 ? '' : 's'}
                </span>
              )}
            </div>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            {loading ? (
              <div className="page-loader">
                <span className="spinner" aria-hidden="true" />
                Loading public projects...
              </div>
            ) : projects.length > 0 ? (
              <>
                <div className="explore-project-list">
                  {projects.map((project) => <ProjectCard key={project.projectId} project={project} />)}
                </div>
                {pagination.pageCount > 1 && (
                  <nav className="explore-pagination" aria-label="Project result pages">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setPage((current) => current - 1)}
                      disabled={page <= 1 || loading}
                    >
                      Previous
                    </button>
                    <span className="muted small">Page {page} of {pagination.pageCount}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setPage((current) => current + 1)}
                      disabled={page >= pagination.pageCount || loading}
                    >
                      Next
                    </button>
                  </nav>
                )}
              </>
            ) : (
              <div className="empty-state">
                <h3>No matching projects</h3>
                <p className="muted">Try changing or clearing the search filters.</p>
              </div>
            )}
          </div>
        </div>
      </section>
      ) : (
        <CommunityFeed user={user} />
      )}
    </>
  );
}
