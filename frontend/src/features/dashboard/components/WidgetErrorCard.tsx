export function WidgetErrorCard({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-4 text-sm">
      <p className="font-medium text-red-700 dark:text-red-300">Couldn't load {title}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded-md border border-red-300 dark:border-red-800 px-3 py-1 text-red-700 dark:text-red-300"
      >
        Retry
      </button>
    </div>
  );
}
