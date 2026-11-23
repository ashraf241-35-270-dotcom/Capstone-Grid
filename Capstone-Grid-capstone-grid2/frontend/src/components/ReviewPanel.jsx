import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api/client.js';
import ReviewScoreSummary from './ReviewScoreSummary.jsx';

export default function ReviewPanel({ project, isTeacher, onProjectChanged }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingReview, setEditingReview] = useState(false);
  const [form, setForm] = useState({
    decision: '',
    feedback: '',
    marks: '',
    rating: ''
  });

  useEffect(() => {
    let active = true;

    api.get(`/projects/${project.projectId}/reviews`)
      .then(({ data }) => {
        if (active) setReviews(data.reviews || []);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err, 'Could not load review history.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [project.projectId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const { data } = await api.post(`/projects/${project.projectId}/reviews`, {
        decision: form.decision || project.status,
        feedback: form.feedback,
        marks: Number(form.marks),
        rating: Number(form.rating)
      });
      setReviews((current) => [data.review, ...current]);
      setForm({ decision: '', feedback: '', marks: '', rating: '' });
      setEditingReview(false);
      await onProjectChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this review.'));
    } finally {
      setSubmitting(false);
    }
  }

  function startEditingReview() {
    const latestReview = reviews[0];
    if (!latestReview) return;
    setForm({
      decision: project.status,
      feedback: latestReview.feedback,
      marks: String(latestReview.marks),
      rating: String(latestReview.rating)
    });
    setEditingReview(true);
    setError('');
  }

  const canUpdateReview = isTeacher
    && ['Accepted', 'Changes Requested'].includes(project.status)
    && reviews.length > 0;

  return (
    <section
      className="review-panel"
      id={`project-reviews-${project.projectId}`}
      aria-label="Project reviews"
      tabIndex="-1"
    >
      <div className="review-panel-head">
        <h4>Reviews &amp; feedback</h4>
        <span className="pill">{reviews.length}</span>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {canUpdateReview && !editingReview && (
        <div className="review-update-action">
          <p className="muted small">Update marks or feedback without losing the previous review entry.</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={startEditingReview}>
            Update marks and feedback
          </button>
        </div>
      )}

      {isTeacher && (project.status === 'Submitted' || editingReview) && (
        <form className="review-form" onSubmit={handleSubmit}>
          {project.status === 'Submitted' ? (
            <label className="field">
              <span className="field-label">Decision</span>
              <select
                value={form.decision}
                onChange={(event) => setForm({ ...form, decision: event.target.value })}
                required
              >
                <option value="">Choose a decision</option>
                <option value="Accepted">Accept project</option>
                <option value="Changes Requested">Request changes</option>
              </select>
            </label>
          ) : (
            <p className="muted small">
              Current decision: <strong>{project.status}</strong>. Saving adds an updated review entry to the history.
            </p>
          )}

          <label className="field">
            <span className="field-label">Feedback</span>
            <textarea
              rows={4}
              maxLength={5000}
              value={form.feedback}
              onChange={(event) => setForm({ ...form, feedback: event.target.value })}
              placeholder="Explain your decision and suggested next steps."
              required
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field-label">Mark (0–100)</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.marks}
                onChange={(event) => setForm({ ...form, marks: event.target.value })}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Rating (1–5)</span>
              <select
                value={form.rating}
                onChange={(event) => setForm({ ...form, rating: event.target.value })}
                required
              >
                <option value="">Choose a rating</option>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <option key={rating} value={rating}>{rating}</option>
                ))}
              </select>
            </label>
          </div>

          <button className="btn btn-primary btn-sm" type="submit" disabled={submitting}>
            {submitting ? 'Saving review...' : (editingReview ? 'Save updated review' : 'Submit review')}
          </button>
          {editingReview && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingReview(false)}>
              Cancel
            </button>
          )}
        </form>
      )}

      {loading ? (
        <p className="muted small">Loading review history...</p>
      ) : reviews.length > 0 ? (
        <div className="review-list">
          {reviews.map((review) => (
            <article className="review-card" key={review.reviewId}>
              <div className="review-card-head">
                <strong>{review.decision}</strong>
                <span className="muted small">{review.teacherName} · {review.reviewedAt}</span>
              </div>
              <ReviewScoreSummary marks={review.marks} rating={review.rating} />
              <div className="review-feedback">
                <h5>Teacher feedback</h5>
                <p>{review.feedback}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted small">No reviews yet.</p>
      )}
    </section>
  );
}
