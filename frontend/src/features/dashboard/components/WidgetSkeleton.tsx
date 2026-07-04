export function WidgetSkeleton({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`} role="status" aria-label="Loading widget">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 rounded bg-gray-200 dark:bg-gray-700" />
      ))}
    </div>
  );
}
