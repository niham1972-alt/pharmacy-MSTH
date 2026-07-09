import { useState } from 'react';
import { DashboardAlert } from '../types/dashboard.types';
import { alertSeverityStyles } from '../../../shared/theme';
import { useAcknowledgeAlert } from '../hooks/useDashboardAlerts';

export function AlertRow({ alert, isNew }: { alert: DashboardAlert; isNew?: boolean }) {
  const styles = alertSeverityStyles[alert.severity];
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const acknowledge = useAcknowledgeAlert();

  // Dense single-line row: colored severity dot + name + detail + right-aligned
  // acknowledge control. The optional note reveals inline on the first click.
  return (
    <li className={`flex items-center gap-2 border-b border-gray-100 py-1.5 last:border-0 dark:border-gray-800 ${isNew ? 'animate-pulse-highlight' : ''}`}>
      {/* Icon is the non-color severity signal; the label stays available to
          screen readers (colorblind-safe: never color alone) without cluttering
          the dense row. */}
      <span aria-hidden="true" title={styles.label} className="shrink-0 text-sm">{styles.icon}</span>
      <span className="sr-only">{styles.label}</span>
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className={`shrink-0 text-xs font-medium ${styles.text}`}>{alert.title}</span>
        <span className="truncate text-xs text-gray-500 dark:text-gray-400" title={alert.detail}>{alert.detail}</span>
      </div>

      {showNoteInput && !alert.acknowledged && (
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Note (optional)"
          aria-label="Acknowledgement note"
          className="w-32 shrink-0 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-0.5 text-xs"
        />
      )}

      {alert.acknowledged ? (
        <span className="shrink-0 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500">Acknowledged</span>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (!showNoteInput) { setShowNoteInput(true); return; }
            acknowledge.mutate({ alert, note: note || undefined });
          }}
          className="shrink-0 whitespace-nowrap rounded border border-gray-300 px-1.5 py-0.5 text-[11px] text-gray-600 hover:border-brand-500 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300"
        >
          {showNoteInput ? 'Confirm' : 'Acknowledge'}
        </button>
      )}
    </li>
  );
}
