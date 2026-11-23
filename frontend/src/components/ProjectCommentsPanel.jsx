import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api/client.js';

export default function ProjectCommentsPanel({ project }) {
  const [comments, setComments] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    api.get(`/projects/${project.projectId}/comments`)
      .then(({ data }) => {
        if (active) setComments(data.comments || []);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err, 'Could not load project comments.'));
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
    setSending(true);

    try {
      const { data } = await api.post(`/projects/${project.projectId}/comments`, { message });
      setComments((current) => [data.comment, ...current]);
      setShowAll(true);
      setMessage('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send this comment.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="project-comments" aria-label="Project conversation">
      <div className="project-comments-heading">
        <h4>Project conversation</h4>
        <span className="pill">{comments.length}</span>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <form className="comment-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Message</span>
          <textarea
            rows={3}
            maxLength={2000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write a message to the project team."
            required
          />
        </label>
        <button className="btn btn-primary btn-sm" type="submit" disabled={sending}>
          {sending ? 'Sending...' : 'Send message'}
        </button>
      </form>

      {loading ? (
        <p className="muted small">Loading conversation...</p>
      ) : comments.length > 0 ? (
        <div className="comment-list">
          {comments.slice(0, showAll ? comments.length : 2).map((comment) => (
            <article className="comment-card" key={comment.commentId}>
              <div className="comment-card-head">
                <strong>{comment.authorName}</strong>
                <span className="pill">{comment.authorRole}</span>
              </div>
              <p>{comment.message}</p>
              <time className="muted small">{comment.createdAt}</time>
            </article>
          ))}
          {comments.length > 2 && (
            <button
              className="btn btn-ghost btn-sm comment-list-toggle"
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((current) => !current)}
            >
              {showAll ? 'Show fewer messages' : `See all ${comments.length} messages`}
            </button>
          )}
        </div>
      ) : (
        <p className="muted small">No messages yet. Start the conversation.</p>
      )}
    </section>
  );
}
