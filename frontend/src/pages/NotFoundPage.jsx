import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="section">
      <div className="container narrow center">
        <span className="eyebrow eyebrow-dark">404</span>
        <h1>This page is not on the grid.</h1>
        <p className="muted">
          The page you were looking for does not exist or may have moved.
        </p>
        <Link className="btn btn-primary" to="/">Back to home</Link>
      </div>
    </section>
  );
}
