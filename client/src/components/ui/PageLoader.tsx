export default function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-ink" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}