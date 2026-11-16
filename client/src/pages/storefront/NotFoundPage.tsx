import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <section className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="mt-4 inline-block underline">
        Back to home
      </Link>
    </section>
  );
}