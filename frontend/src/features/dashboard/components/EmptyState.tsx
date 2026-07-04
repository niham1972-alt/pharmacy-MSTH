import { ReactNode } from 'react';

export function EmptyState({
  icon = '📭',
  message,
  action,
}: {
  icon?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
      <span aria-hidden="true" className="text-2xl">
        {icon}
      </span>
      <p>{message}</p>
      {action}
    </div>
  );
}
