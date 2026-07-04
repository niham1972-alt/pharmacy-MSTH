import { useTranslation } from 'react-i18next';
import { useActivityFeed } from '../hooks/useActivityFeed';
import { WidgetSkeleton } from './WidgetSkeleton';
import { WidgetErrorCard } from './WidgetErrorCard';
import { EmptyState } from './EmptyState';

export function ActivityFeed() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useActivityFeed();
  const items = data?.pages.flat() ?? [];

  return (
    <section aria-labelledby="activity-feed-heading" className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <h2 id="activity-feed-heading" className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {t('dashboard.activity.title')}
      </h2>

      {isLoading && <WidgetSkeleton rows={5} />}
      {isError && <WidgetErrorCard title={t('dashboard.activity.title')} onRetry={() => refetch()} />}
      {!isLoading && !isError && items.length === 0 && <EmptyState message={t('dashboard.activity.empty')} />}
      {!isLoading && !isError && items.length > 0 && (
        <>
          <ul className="space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.id} className="border-b border-gray-100 dark:border-gray-800 pb-2">
                <p className="text-gray-800 dark:text-gray-200">
                  {item.action.replace(/_/g, ' ')} — {item.entityType}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(item.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
          {hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="mt-3 text-xs font-medium text-brand-600 dark:text-brand-500"
            >
              {t('dashboard.activity.loadMore')}
            </button>
          )}
        </>
      )}
    </section>
  );
}
