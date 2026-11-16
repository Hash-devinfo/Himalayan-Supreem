export default function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-300 border-t-stone-800" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}