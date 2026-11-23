export default function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`block rounded-md bg-sage-soft motion-safe:animate-pulse ${className}`} aria-hidden="true" />;
}