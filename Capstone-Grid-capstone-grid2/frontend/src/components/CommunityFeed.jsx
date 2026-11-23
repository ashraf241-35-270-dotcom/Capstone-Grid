import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../api/client.js';

function PostCard({ post, user, onCommentAdded, eagerImage }) {
  const [opinion, setOpinion] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const imageUrl = post.imageUrl ? api.getUri({ url: post.imageUrl }) : null;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSending(true);
    try {
      const { data } = await api.post(`/posts/${post.postId}/comments`, { opinion });
      onCommentAdded(post.postId, data.comment);
      setOpinion('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add your opinion.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <article className="community-post">
      <header className="community-post-head">
        <div>
          <strong>{post.authorName}</strong>
          <span className="pill">{post.authorRole}</span>
        </div>
        <time className="muted small">{post.createdAt}</time>
      </header>

      {post.content && <p className="community-post-content">{post.content}</p>}
      {imageUrl && (
        <img
          className="community-post-image"
          src={imageUrl}
          alt={`Photo shared by ${post.authorName}`}
          loading={eagerImage ? 'eager' : 'lazy'}
          decoding="async"
        />
      )}

      <section className="post-opinions" aria-label="Post opinions">
        <h4>Opinions <span className="pill">{post.comments.length}</span></h4>
        {post.comments.length > 0 ? (
          <div className="post-opinion-list">
            {post.comments.map((comment) => (
              <article className="post-opinion" key={comment.commentId}>
                <div className="comment-card-head">
                  <strong>{comment.authorName}</strong>
                  <span className="pill">{comment.authorRole}</span>
                </div>
                <p>{comment.opinion}</p>
                <time className="muted small">{comment.createdAt}</time>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted small">No opinions yet.</p>
        )}
      </section>

      {user ? (
        <form className="post-opinion-form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Add your opinion</span>
            <textarea
              rows={2}
              maxLength={1000}
              value={opinion}
              onChange={(event) => setOpinion(event.target.value)}
              placeholder="Share a constructive response."
              required
            />
          </label>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <button className="btn btn-ghost btn-sm" type="submit" disabled={sending}>
            {sending ? 'Posting...' : 'Post opinion'}
          </button>
        </form>
      ) : (
        <p className="muted small"><Link to="/login">Log in</Link> to share an opinion.</p>
      )}
    </article>
  );
}

export default function CommunityFeed({ user }) {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pageSize: 30, pageCount: 0, total: 0 });
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const imageInput = useRef(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/posts', { params: { page } });
      setPosts(data.posts || []);
      setPagination(data.pagination || { page, pageSize: 30, pageCount: 0, total: 0 });
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load community posts.'));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  async function handleCreatePost(event) {
    event.preventDefault();
    setError('');
    if (!content.trim() && !image) {
      setError('Add text or choose an image for your post.');
      return;
    }

    const formData = new FormData();
    formData.append('content', content);
    if (image) formData.append('image', image);

    setCreating(true);
    try {
      const { data } = await api.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (page === 1) {
        setPosts((current) => [data.post, ...current].slice(0, pagination.pageSize));
        setPagination((current) => {
          const total = current.total + 1;
          return { ...current, total, pageCount: Math.ceil(total / current.pageSize) };
        });
      } else {
        setPage(1);
      }
      setContent('');
      setImage(null);
      if (imageInput.current) imageInput.current.value = '';
    } catch (err) {
      setError(getErrorMessage(err, 'Could not publish your post.'));
    } finally {
      setCreating(false);
    }
  }

  function addComment(postId, comment) {
    setPosts((current) => current.map((post) => (
      post.postId === postId
        ? { ...post, comments: [...post.comments, comment] }
        : post
    )));
  }

  return (
    <section className="section community-section">
      <div className="container community-layout">
        <header className="community-heading">
          <span className="eyebrow eyebrow-dark">Community</span>
          <h2>All public posts</h2>
          <p className="muted">Browse every public post and opinion, newest first.</p>
          {!loading && (
            <span className="pill pill-public">
              {pagination.total} post{pagination.total === 1 ? '' : 's'}
            </span>
          )}
        </header>

        <div className="community-column">
          {user ? (
            <form className="card community-create" onSubmit={handleCreatePost}>
              <h3>Share a post</h3>
              <label className="field">
                <span className="field-label">Text (optional with an image)</span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="What are you working on?"
                />
              </label>
              <label className="field">
                <span className="field-label">Image (optional)</span>
                <input
                  ref={imageInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setImage(event.target.files?.[0] || null)}
                />
                <span className="muted small">PNG, JPEG, or WebP, up to 5 MB.</span>
              </label>
              {error && <div className="alert alert-error" role="alert">{error}</div>}
              <button className="btn btn-primary" type="submit" disabled={creating}>
                {creating ? 'Publishing...' : 'Publish post'}
              </button>
            </form>
          ) : (
            <div className="card community-create community-signin">
              <h3>Join the conversation</h3>
              <p className="muted">Log in to publish posts and share opinions.</p>
              <Link className="btn btn-primary" to="/login">Log in</Link>
            </div>
          )}

          <div className="community-posts">
            {error && !user && <div className="alert alert-error" role="alert">{error}</div>}
            {loading ? (
              <div className="page-loader">
                <span className="spinner" aria-hidden="true" />
                Loading community posts...
              </div>
            ) : posts.length > 0 ? (
              posts.map((post, index) => (
                <PostCard
                  key={post.postId}
                  post={post}
                  user={user}
                  onCommentAdded={addComment}
                  eagerImage={index < 3}
                />
              ))
            ) : (
              <div className="empty-state">
                <h3>No community posts yet</h3>
                <p className="muted">Be the first to share an update.</p>
              </div>
            )}
            {!loading && pagination.pageCount > 1 && (
              <nav className="explore-pagination" aria-label="Public post pages">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPage((current) => current - 1)}
                  disabled={page <= 1}
                >
                  Previous
                </button>
                <span className="muted small">
                  Page {page} of {pagination.pageCount}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={page >= pagination.pageCount}
                >
                  Next
                </button>
              </nav>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
