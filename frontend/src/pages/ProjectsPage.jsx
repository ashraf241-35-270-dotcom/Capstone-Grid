import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ProjectTrackingPanel from '../components/ProjectTrackingPanel.jsx';
import ReviewPanel from '../components/ReviewPanel.jsx';
import ProjectCommentsPanel from '../components/ProjectCommentsPanel.jsx';
import ReviewScoreSummary from '../components/ReviewScoreSummary.jsx';

export default function ProjectsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isStudent = user.role === 'Student';
  const highlightedLocation = useRef(null);
  const requestedView = searchParams.get('view');
  const activeView = isStudent || !['review', 'feedback'].includes(requestedView)
    ? 'all'
    : requestedView;
  const sectionFilter = isStudent ? '' : (searchParams.get('sectionId') || '');

  const [projects, setProjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    sectionId: '',
    categoryId: '',
    visibility: 'Private'
  });
  const [formError, setFormError] = useState('');
  const [uploadingId, setUploadingId] = useState(null);
  const [statusActionId, setStatusActionId] = useState(null);
  const [fileError, setFileError] = useState('');
  const visibleProjects = projects.filter((project) => {
    if (sectionFilter && String(project.sectionId) !== sectionFilter) return false;
    if (activeView === 'review') return project.status === 'Submitted';
    if (activeView === 'feedback') return Boolean(project.reviewSummary);
    return true;
  });
  const projectPageTitle = isStudent
    ? 'My capstone projects'
    : (activeView === 'review'
      ? 'Review queue'
      : (activeView === 'feedback' ? 'Marks and feedback' : 'Assigned project tracking'));
  const projectPageDescription = isStudent
    ? 'Create projects, manage milestones, and track progress.'
    : (activeView === 'review'
      ? 'Review submitted projects and record a decision, marks, rating, and feedback.'
      : (activeView === 'feedback'
        ? 'See existing decisions and scores, then update marks and feedback while preserving review history.'
        : 'View milestones, tasks, deadlines, and progress for your students.'));

  useEffect(() => {
    if (loading || highlightedLocation.current === location.key) return;
    const uploadProjectId = location.state?.highlightProjectId;
    const projectId = searchParams.get('projectId');
    const target = uploadProjectId
      ? document.getElementById(`project-files-${uploadProjectId}`)
      : (projectId
        ? document.getElementById(searchParams.get('focus') === 'review'
          ? `project-reviews-${projectId}`
          : `project-record-${projectId}`)
        : null);
    if (!target) return;
    highlightedLocation.current = location.key;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus({ preventScroll: true });
    if (uploadProjectId) target.classList.add('project-upload-highlight');
    const timer = window.setTimeout(
      () => target.classList.remove('project-upload-highlight'),
      5000
    );
    return () => window.clearTimeout(timer);
  }, [loading, location.key, location.state, location.search, searchParams, projects]);

  const loadProjects = useCallback(async () => {
    const { data } = await api.get('/projects');
    setProjects(data.projects || []);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const responses = await Promise.all([
          api.get('/projects'),
          api.get('/sections'),
          ...(isStudent ? [api.get('/categories')] : [])
        ]);

        if (!active) return;
        setProjects(responses[0].data.projects || []);
        setSections(responses[1].data.sections || []);
        if (isStudent) {
          setCategories(responses[2].data.categories || []);
        }
      } catch (err) {
        if (active) setError(getErrorMessage(err, 'Could not load the project repository.'));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [isStudent]);

  function updateProjectFilter(name, value) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(name, value);
      else next.delete(name);
      next.delete('projectId');
      next.delete('focus');
      return next;
    }, { replace: true });
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setCreating(true);

    try {
      await api.post('/projects', {
        title: form.title.trim(),
        description: form.description.trim(),
        sectionId: Number(form.sectionId),
        categoryId: Number(form.categoryId),
        visibility: form.visibility
      });

      setForm({
        title: '',
        description: '',
        sectionId: '',
        categoryId: '',
        visibility: 'Private'
      });
      await loadProjects();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not create the project.'));
    } finally {
      setCreating(false);
    }
  }

  async function handleUpload(projectId, event) {
    const fileList = Array.from(event.target.files || []);
    if (fileList.length === 0) return;

    const formData = new FormData();
    fileList.forEach((file) => formData.append('files', file));

    setUploadingId(projectId);
    try {
      await api.post(`/projects/${projectId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await loadProjects();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not upload the files.'));
    } finally {
      setUploadingId(null);
      event.target.value = '';
    }
  }

  async function downloadProjectFile(projectId, file) {
    setFileError('');
    try {
      const { data } = await api.get(`/projects/${projectId}/files/${file.fileId}`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setFileError(getErrorMessage(err, 'Could not download the project file.'));
    }
  }

  async function changeProjectStatus(project) {
    const nextStatus = project.status === 'Accepted'
      ? 'Archived'
      : (project.status === 'Draft' || project.status === 'Changes Requested'
        ? 'In Progress'
        : 'Submitted');
    const confirmation = nextStatus === 'Submitted'
      ? 'Submit this project for review?'
      : (nextStatus === 'Archived'
        ? 'Archive this accepted project? It will become read-only.'
        : null);
    if (confirmation && !window.confirm(confirmation)) return;

    setError('');
    setStatusActionId(project.projectId);
    try {
      await api.put(`/projects/${project.projectId}`, { status: nextStatus });
      await loadProjects();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update the project status.'));
    } finally {
      setStatusActionId(null);
    }
  }

  return (
    <>
      <section className="page-head">
        <div className="container page-head-inner">
          <div>
            <span className="eyebrow eyebrow-dark">Project workspace</span>
            <h1>{projectPageTitle}</h1>
            <p className="muted">{projectPageDescription}</p>
          </div>
          <span className="pill pill-public">{visibleProjects.length} {visibleProjects.length === 1 ? 'project' : 'projects'}</span>
        </div>
      </section>

      <section className="section section-tight">
        <div className="container">
          {error && <div className="alert alert-error">{error}</div>}
          {fileError && <div className="alert alert-error" role="alert">{fileError}</div>}
          {loading ? (
            <div className="page-loader">
              <span className="spinner" aria-hidden="true" />
              Loading project repository...
            </div>
          ) : (
            <div className={`sections-layout ${isStudent ? '' : 'projects-only-layout'}`}>
              {isStudent && <form className="card create-section-card" onSubmit={handleCreate}>
                <span className="eyebrow eyebrow-dark">New repository</span>
                <h2>Create a project</h2>
                <p className="muted small">Keep your project linked to a section, category and visibility level.</p>

                {formError && <div className="alert alert-error">{formError}</div>}

                <label className="field">
                  <span className="field-label">Title</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    placeholder="Capstone dashboard redesign"
                    maxLength={160}
                    required
                  />
                </label>

                <label className="field">
                  <span className="field-label">Description</span>
                  <textarea
                    rows={5}
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    placeholder="Describe your project goal, architecture and current progress."
                    required
                  />
                </label>

                <div className="field-row">
                  <label className="field">
                    <span className="field-label">Section</span>
                    <select value={form.sectionId} onChange={(event) => setForm({ ...form, sectionId: event.target.value })} required>
                      <option value="">Select section</option>
                      {sections.map((section) => (
                        <option key={section.section_id} value={section.section_id}>
                          {section.course_code} · {section.section_name} ({section.semester})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span className="field-label">Category</span>
                    <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required>
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category.category_id} value={category.category_id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span className="field-label">Visibility</span>
                  <select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}>
                    <option value="Private">Private</option>
                    <option value="Public">Public</option>
                  </select>
                </label>

                <button className="btn btn-primary btn-block" type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create repository'}
                </button>
              </form>}

              <div className="section-list-wrap">
                {!isStudent && (
                  <div className="teacher-project-filters">
                    <label className="field">
                      <span className="field-label">Project view</span>
                      <select
                        value={activeView}
                        onChange={(event) => updateProjectFilter('view', event.target.value === 'all' ? '' : event.target.value)}
                      >
                        <option value="all">All projects</option>
                        <option value="review">Review queue</option>
                        <option value="feedback">Marks and feedback</option>
                      </select>
                    </label>
                    <label className="field">
                      <span className="field-label">Section</span>
                      <select value={sectionFilter} onChange={(event) => updateProjectFilter('sectionId', event.target.value)}>
                        <option value="">All sections</option>
                        {sections.map((section) => (
                          <option key={section.section_id} value={section.section_id}>
                            {section.course_code} · {section.section_name} ({section.semester})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                <div className="list-head">
                  <h2>{isStudent ? 'Project list' : projectPageTitle}</h2>
                  <span className="pill">{visibleProjects.length}</span>
                </div>

                {visibleProjects.length === 0 ? (
                  <div className="empty-state">
                    <h3>{projects.length === 0 ? 'No projects yet' : 'No matching projects'}</h3>
                    <p className="muted">
                      {projects.length === 0
                        ? (isStudent
                          ? 'Create your first project repository to start tracking progress.'
                          : 'Projects from your assigned sections will appear here.')
                        : (activeView === 'review'
                          ? 'No submitted projects are waiting for review in this section.'
                          : (activeView === 'feedback'
                            ? 'No reviewed projects match this section filter.'
                            : 'No projects match this section filter.'))}
                    </p>
                  </div>
                ) : (
                  <div className="section-list">
                    {visibleProjects.map((project) => (
                      <article className="section-card" id={`project-record-${project.projectId}`} tabIndex="-1" key={project.projectId}>
                        <div className="section-card-head">
                          <div>
                            <span className="section-code">{project.sectionName || 'Section'} · {project.status}</span>
                            <h3>{project.title}</h3>
                            <p className="muted small section-subtitle">
                              {project.categoryName || 'Uncategorized'} · {project.visibility}
                              {!isStudent && project.studentName ? ` · ${project.studentName}` : ''}
                            </p>
                            {project.reviewSummary && (
                              <ReviewScoreSummary
                                marks={project.reviewSummary.marks}
                                rating={project.reviewSummary.rating}
                                compact
                              />
                            )}
                          </div>
                          <span className="pill pill-public">{project.fileCount} file(s)</span>
                        </div>

                        <p className="muted">{project.description}</p>

                        <div className="section-actions">
                          <span className="pill pill-soon">{project.status}</span>
                          <span className="pill pill-progress">{project.visibility}</span>
                          {isStudent && ['Draft', 'In Progress', 'Changes Requested', 'Accepted'].includes(project.status) && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => changeProjectStatus(project)}
                              disabled={statusActionId === project.projectId}
                            >
                              {statusActionId === project.projectId
                                ? 'Updating...'
                                : (project.status === 'Draft'
                                  ? 'Start project'
                                  : (project.status === 'Changes Requested'
                                    ? 'Start revisions'
                                    : (project.status === 'Accepted' ? 'Archive project' : 'Submit project')))}
                            </button>
                          )}
                        </div>

                        <div className="progress-summary">
                          <div
                            className="progress-track"
                            role="progressbar"
                            aria-label={`${project.title} completion`}
                            aria-valuemin="0"
                            aria-valuemax="100"
                            aria-valuenow={project.progressPercent}
                          >
                            <span style={{ width: `${project.progressPercent}%` }} />
                          </div>
                          <span className="muted small">{project.progressPercent}% complete</span>
                        </div>

                        <ProjectTrackingPanel
                          project={project}
                          readOnly={!isStudent || project.status === 'Archived'}
                          onProjectChanged={loadProjects}
                        />

                        <ReviewPanel
                          project={project}
                          isTeacher={!isStudent}
                          onProjectChanged={loadProjects}
                        />

                        <section
                          className={`project-files${!isStudent && project.files?.length ? ' project-files-teacher' : ''}`}
                          id={`project-files-${project.projectId}`}
                          aria-label={`Files for ${project.title}`}
                          tabIndex="-1"
                        >
                          <div className="project-files-heading">
                            <h4>{!isStudent && project.files?.length ? 'Latest student uploads' : 'Project files'}</h4>
                            <span className="pill">{project.files?.length || 0}</span>
                          </div>
                          {project.files?.length ? (
                            <ul className="project-file-list">
                              {project.files.map((file) => (
                                <li key={file.fileId}>
                                  <button
                                    className="project-file-link"
                                    type="button"
                                    onClick={() => downloadProjectFile(project.projectId, file)}
                                  >
                                    {file.name}
                                  </button>
                                  <span className="muted small">
                                    {(file.size / (1024 * 1024)).toFixed(2)} MB · {file.uploadedAt}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="muted small">No files uploaded yet.</p>
                          )}
                        </section>

                        {isStudent && ['Draft', 'In Progress', 'Changes Requested'].includes(project.status) && <div className="upload-box">
                          <label className="btn btn-ghost btn-sm upload-button">
                            <input type="file" multiple onChange={(event) => handleUpload(project.projectId, event)} />
                            {uploadingId === project.projectId ? 'Uploading...' : 'Upload files'}
                          </label>
                          <span className="muted small">New files appear in this project as soon as upload finishes; your teacher is notified.</span>
                        </div>}
                        <ProjectCommentsPanel project={project} />
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
