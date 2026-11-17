import { useCallback, useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const SEMESTERS = (() => {
  const year = new Date().getFullYear();
  const options = [];
  for (let y = year + 1; y >= year - 1; y -= 1) {
    for (const term of ['Spring', 'Summer', 'Fall']) {
      options.push(`${term} ${y}`);
    }
  }
  return options;
})();

function SectionCard({ section, isTeacher, onChanged }) {
  const [open, setOpen] = useState(false);
  const [roster, setRoster] = useState(null);
  const [rosterError, setRosterError] = useState('');
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [email, setEmail] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function loadRoster() {
    setLoadingRoster(true);
    setRosterError('');
    try {
      const { data } = await api.get(`/sections/${section.section_id}`);
      setRoster(data.students || []);
    } catch (err) {
      setRosterError(getErrorMessage(err, 'Could not load the roster.'));
    } finally {
      setLoadingRoster(false);
    }
  }

  function toggleRoster() {
    if (!open && !roster) loadRoster();
    setOpen(!open);
  }

  async function handleEnroll(event) {
    event.preventDefault();
    setActionError('');
    setBusy(true);
    try {
      await api.post(`/sections/${section.section_id}/enrollments`, { email: email.trim() });
      setEmail('');
      await loadRoster();
      await onChanged();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not enroll that student.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(student) {
    if (!window.confirm(`Remove ${student.name} from ${section.section_name}?`)) return;
    setActionError('');
    setBusy(true);
    try {
      await api.delete(`/sections/${section.section_id}/enrollments/${student.student_id}`);
      await loadRoster();
      await onChanged();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not remove that student.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${section.course_code} ${section.section_name} (${section.semester})?`)) return;
    setActionError('');
    setDeleting(true);
    try {
      await api.delete(`/sections/${section.section_id}`);
      await onChanged();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not delete this section.'));
      setDeleting(false);
    }
  }

  return (
    <article className="section-card">
      <div className="section-card-head">
        <div>
          <span className="section-code">{section.course_code} · {section.semester}</span>
          <h3>{section.section_name}</h3>
          <p className="muted small section-subtitle">
            {section.course_title} — {section.department_name}
          </p>
        </div>
        <span className="pill pill-student">
          {section.student_count} {section.student_count === 1 ? 'student' : 'students'}
        </span>
      </div>

      {isTeacher ? (
        <div className="section-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={toggleRoster}>
            {open ? 'Hide roster' : 'Manage roster'}
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      ) : (
        <p className="small muted section-teacher">Teacher: {section.teacher_name}</p>
      )}

      {actionError && <div className="alert alert-error">{actionError}</div>}

      {isTeacher && open && (
        <div className="roster">
          <form className="roster-form" onSubmit={handleEnroll}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="student@university.edu"
              aria-label="Student email to enroll"
              required
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
              {busy ? 'Working...' : 'Enroll student'}
            </button>
          </form>

          {loadingRoster && <p className="muted small">Loading roster...</p>}
          {rosterError && <div className="alert alert-error">{rosterError}</div>}

          {!loadingRoster && !rosterError && roster && (
            roster.length === 0 ? (
              <p className="muted small">No students enrolled yet. Add one by email above.</p>
            ) : (
              <div className="roster-table-wrap">
                <table className="roster-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Email</th>
                      <th>Department</th>
                      <th>Enrolled</th>
                      <th><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((student) => (
                      <tr key={student.enrollment_id}>
                        <td>{student.name}</td>
                        <td className="muted">{student.email}</td>
                        <td className="muted">{student.department_name || '—'}</td>
                        <td className="muted">{String(student.enrolled_at).slice(0, 10)}</td>
                        <td className="roster-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleRemove(student)}
                            disabled={busy}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}
    </article>
  );
}

export default function SectionsPage() {
  const { user } = useAuth();
  const isTeacher = user.role === 'Teacher';

  const [sections, setSections] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [courseId, setCourseId] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [semester, setSemester] = useState('');
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  const loadSections = useCallback(async () => {
    const { data } = await api.get('/sections');
    setSections(data.sections);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const requests = [api.get('/sections')];
        if (isTeacher) requests.push(api.get('/courses'));
        const [sectionsResponse, coursesResponse] = await Promise.all(requests);
        if (!active) return;
        setSections(sectionsResponse.data.sections);
        if (coursesResponse) setCourses(coursesResponse.data.courses);
      } catch (err) {
        if (active) setError(getErrorMessage(err, 'Could not load sections.'));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [isTeacher]);

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setCreating(true);
    try {
      await api.post('/sections', {
        courseId: Number(courseId),
        sectionName: sectionName.trim(),
        semester: semester.trim()
      });
      setCourseId('');
      setSectionName('');
      setSemester('');
      await loadSections();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not create the section.'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <section className="page-head">
        <div className="container page-head-inner">
          <div>
            <span className="eyebrow eyebrow-dark">Academic structure</span>
            <h1>{isTeacher ? 'Section management' : 'My sections'}</h1>
            <p className="muted">
              {isTeacher
                ? 'Create sections for your courses, then enroll students by their account email.'
                : 'These are the sections your teachers have enrolled you in.'}
            </p>
          </div>
          <span className="pill pill-public">
            {sections.length} {sections.length === 1 ? 'section' : 'sections'}
          </span>
        </div>
      </section>

      <section className="section section-tight">
        <div className="container">
          {error && <div className="alert alert-error">{error}</div>}
          {loading ? (
            <div className="page-loader">
              <span className="spinner" aria-hidden="true" />
              Loading sections...
            </div>
          ) : isTeacher ? (
            <div className="sections-layout">
              <form className="card create-section-card" onSubmit={handleCreate}>
                <span className="eyebrow eyebrow-dark">New section</span>
                <h2>Create a section</h2>
                <p className="muted small">After creating it, enroll students by email.</p>

                {formError && <div className="alert alert-error">{formError}</div>}

                <label className="field">
                  <span className="field-label">Course</span>
                  <select value={courseId} onChange={(event) => setCourseId(event.target.value)} required>
                    <option value="">Select a course</option>
                    {courses.map((course) => (
                      <option key={course.course_id} value={course.course_id}>
                        {course.course_code} — {course.title} ({course.department_name})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">Section name</span>
                  <input
                    type="text"
                    value={sectionName}
                    onChange={(event) => setSectionName(event.target.value)}
                    placeholder="e.g. Section A"
                    minLength={2}
                    maxLength={80}
                    required
                  />
                </label>

                <label className="field">
                  <span className="field-label">Semester</span>
                  <input
                    type="text"
                    list="semester-options"
                    value={semester}
                    onChange={(event) => setSemester(event.target.value)}
                    placeholder="e.g. Fall 2026"
                    minLength={2}
                    maxLength={50}
                    required
                  />
                  <datalist id="semester-options">
                    {SEMESTERS.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </label>

                <button className="btn btn-primary btn-block" type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create section'}
                </button>
              </form>

              <div className="section-list-wrap">
                <div className="list-head">
                  <h2>Your sections</h2>
                  <span className="pill">{sections.length}</span>
                </div>

                {sections.length === 0 ? (
                  <div className="empty-state">
                    <h3>No sections yet</h3>
                    <p className="muted">Use the form to create your first section.</p>
                  </div>
                ) : (
                  <div className="section-list">
                    {sections.map((section) => (
                      <SectionCard
                        key={section.section_id}
                        section={section}
                        isTeacher
                        onChanged={loadSections}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="section-list-wrap">
              <div className="list-head">
                <h2>Enrolled sections</h2>
                <span className="pill">{sections.length}</span>
              </div>

              {sections.length === 0 ? (
                <div className="empty-state">
                  <h3>Not enrolled yet</h3>
                  <p className="muted">
                    Your teacher will enroll you using your account email. Check back later.
                  </p>
                </div>
              ) : (
                <div className="section-list">
                  {sections.map((section) => (
                    <SectionCard key={section.section_id} section={section} isTeacher={false} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
