import { useEffect, useState } from 'react';
import { formatPercentChange, percentChangeDirection } from '../utils/formatPercentChange';

function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const progress = Math.min((now - start) / durationMs, 1);
      setValue(from + (target - from) * progress);
      if (progress < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

export interface KpiCardProps {
  label: string;
  value: number;
  formatValue?: (n: number) => string;
  changePct?: number | 'new';
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onClick?: () => void;
}

export function KpiCard({ label, value, formatValue, changePct, loading, error, onRetry, onClick }: KpiCardProps) {
  const animated = useCountUp(loading || error ? 0 : value);
  const direction = percentChangeDirection(changePct);

  if (loading) {
    return (
      <div className="animate-pulse rounded-lg border border-gray-200 dark:border-gray-800 p-3">
        <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-2.5 h-5 w-16 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-3">
        <p className="text-xs font-medium text-red-700 dark:text-red-300">Couldn't load {label}</p>
        <button type="button" onClick={onRetry} className="mt-1 text-xs underline text-red-700 dark:text-red-300">
          Retry
        </button>
      </div>
    );
  }

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={`w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-left ${
        onClick ? 'cursor-pointer transition hover:border-brand-500 hover:shadow-sm' : ''
      }`}
    >
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500" title={label}>{label}</p>
      <p className="mt-0.5 text-xl font-semibold leading-tight text-gray-900 dark:text-gray-100">
        {formatValue ? formatValue(animated) : Math.round(animated)}
      </p>
      {changePct !== undefined && (
        <p
          className={`mt-0.5 text-[10px] ${
            direction === 'up' ? 'text-green-600/80 dark:text-green-400/80' : direction === 'down' ? 'text-red-600/80 dark:text-red-400/80' : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {formatPercentChange(changePct)} vs prev
        </p>
      )}
    </Wrapper>
  );
}
