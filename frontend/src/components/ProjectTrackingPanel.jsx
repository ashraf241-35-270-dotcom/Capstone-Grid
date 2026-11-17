import { useState } from 'react';
import api, { getErrorMessage } from '../api/client.js';

const STATUSES = ['Not Started', 'In Progress', 'Completed'];

function dateValue(value) {
  return value ? String(value).slice(0, 10) : '';
}

function MilestoneCard({ projectId, milestone, readOnly, onChanged }) {
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function updateMilestone(changes) {
    setError('');
    setBusy(true);
    try {
      await api.put(`/projects/${projectId}/milestones/${milestone.milestone_id}`, changes);
      await onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update the milestone.'));
    } finally {
      setBusy(false);
    }
  }

  async function addTask(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post(`/projects/${projectId}/milestones/${milestone.milestone_id}/tasks`, {
        title: taskTitle.trim(),
        dueDate: taskDueDate || null
      });
      setTaskTitle('');
      setTaskDueDate('');
      await onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add the task.'));
    } finally {
      setBusy(false);
    }
  }

  async function updateTask(task, changes) {
    setError('');
    setBusy(true);
    try {
      await api.put(
        `/projects/${projectId}/milestones/${milestone.milestone_id}/tasks/${task.task_id}`,
        changes
      );
      await onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update the task.'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteMilestone() {
    if (!window.confirm(`Delete "${milestone.title}" and its tasks?`)) return;
    setError('');
    setBusy(true);
    try {
      await api.delete(`/projects/${projectId}/milestones/${milestone.milestone_id}`);
      await onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete the milestone.'));
      setBusy(false);
    }
  }

  async function deleteTask(task) {
    setError('');
    setBusy(true);
    try {
      await api.delete(
        `/projects/${projectId}/milestones/${milestone.milestone_id}/tasks/${task.task_id}`
      );
      await onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete the task.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="milestone-card">
      <div className="milestone-heading">
        <div>
          <h3>{milestone.title}</h3>
          {milestone.description && <p className="muted small">{milestone.description}</p>}
        </div>
        <span className="pill pill-progress">{milestone.status}</span>
      </div>

      <div className="tracking-fields">
        <label className="tracking-field">
          <span>Deadline</span>
          <input
            type="date"
            value={dateValue(milestone.deadline)}
            disabled={readOnly || busy}
            onChange={(event) => updateMilestone({ deadline: event.target.value || null })}
          />
        </label>
        {milestone.tasks.length === 0 && (
          <label className="tracking-field">
            <span>Status</span>
            <select
              value={milestone.status}
              disabled={readOnly || busy}
              onChange={(event) => updateMilestone({ status: event.target.value })}
            >
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        )}
        {!readOnly && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={deleteMilestone} disabled={busy}>
            Delete milestone
          </button>
        )}
      </div>

      <div className="task-list">
        {milestone.tasks.length === 0 ? (
          <p className="muted small">No tasks yet.</p>
        ) : milestone.tasks.map((task) => (
          <div className="task-row" key={task.task_id}>
            <span>{task.title}</span>
            <input
              type="date"
              aria-label={`Due date for ${task.title}`}
              value={dateValue(task.due_date)}
              disabled={readOnly || busy}
              onChange={(event) => updateTask(task, { dueDate: event.target.value || null })}
            />
            <select
              aria-label={`Status for ${task.title}`}
              value={task.status}
              disabled={readOnly || busy}
              onChange={(event) => updateTask(task, { status: event.target.value })}
            >
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
            {!readOnly && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label={`Delete ${task.title}`}
                onClick={() => deleteTask(task)}
                disabled={busy}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <form className="task-form" onSubmit={addTask}>
          <input
            type="text"
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            placeholder="Add a task"
            maxLength={160}
            required
          />
          <input
            type="date"
            aria-label="Task due date"
            value={taskDueDate}
            onChange={(event) => setTaskDueDate(event.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            Add task
          </button>
        </form>
      )}
      {error && <div className="alert alert-error tracking-error">{error}</div>}
    </article>
  );
}

export default function ProjectTrackingPanel({ project, readOnly, onProjectChanged }) {
  const [open, setOpen] = useState(false);
  const [tracking, setTracking] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function loadTracking() {
    const { data } = await api.get(`/projects/${project.projectId}/tracking`);
    setTracking(data);
  }

  async function toggleOpen() {
    if (!open && !tracking) {
      setLoading(true);
      setError('');
      try {
        await loadTracking();
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load project tracking.'));
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    setOpen(!open);
  }

  async function refreshTracking() {
    await loadTracking();
    await onProjectChanged();
  }

  async function addMilestone(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post(`/projects/${project.projectId}/milestones`, {
        title: title.trim(),
        description: description.trim(),
        deadline: deadline || null
      });
      setTitle('');
      setDescription('');
      setDeadline('');
      await refreshTracking();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add the milestone.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="project-tracking">
      <div className="tracking-toggle-row">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={toggleOpen}
          aria-expanded={open}
        >
          {open ? 'Hide tracking' : (readOnly ? 'View tracking' : 'Manage tracking')}
        </button>
        <span className="muted small">
          {project.progressPercent}% complete · {project.milestoneCount} milestones · {project.taskCount} tasks
        </span>
      </div>

      {open && (
        <div className="tracking-panel">
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

          {!readOnly && (
            <form className="milestone-form" onSubmit={addMilestone}>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="New milestone"
                maxLength={160}
                required
              />
              <input
                type="date"
                aria-label="Milestone deadline"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                Add milestone
              </button>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional milestone details"
                maxLength={2000}
                rows={2}
              />
            </form>
          )}

          {loading && <p className="muted small">Loading tracking...</p>}
          {error && <div className="alert alert-error tracking-error">{error}</div>}
          {!loading && tracking && (tracking.milestones.length === 0 ? (
            <div className="empty-state tracking-empty">
              <p>{readOnly ? 'No milestones have been added yet.' : 'Add a milestone to start tracking this project.'}</p>
            </div>
          ) : (
            <div className="milestone-list">
              {tracking.milestones.map((milestone) => (
                <MilestoneCard
                  key={milestone.milestone_id}
                  projectId={project.projectId}
                  milestone={milestone}
                  readOnly={readOnly}
                  onChanged={refreshTracking}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
