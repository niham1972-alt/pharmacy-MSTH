import { useState } from 'react';
import { DashboardAlert } from '../types/dashboard.types';
import { alertSeverityStyles } from '../../../shared/theme';
import { useAcknowledgeAlert } from '../hooks/useDashboardAlerts';

export function AlertRow({ alert, isNew }: { alert: DashboardAlert; isNew?: boolean }) {
  const styles = alertSeverityStyles[alert.severity];
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const acknowledge = useAcknowledgeAlert();

  return (
    <li
      className={`flex items-start justify-between gap-3 rounded-md p-3 ${styles.bg} ${isNew ? 'animate-pulse-highlight' : ''}`}
    >
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="text-lg">
          {styles.icon}
        </span>
        <div>
          <p className={`text-sm font-medium ${styles.text}`}>
            {styles.label}: {alert.title}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">{alert.detail}</p>
          {showNoteInput && (
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Optional note"
              aria-label="Acknowledgement note"
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
            />
          )}
        </div>
      </div>

      {alert.acknowledged ? (
        <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">Acknowledged</span>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (!showNoteInput) {
              setShowNoteInput(true);
              return;
            }
            acknowledge.mutate({ alert, note: note || undefined });
          }}
          className="whitespace-nowrap rounded-md border border-gray-300 dark:border-gray-700 px-2 py-1 text-xs"
        >
          {showNoteInput ? 'Confirm' : 'Acknowledge'}
        </button>
      )}
    </li>
  );
}
