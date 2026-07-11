import { formatCurrency } from '../../dashboard/utils/formatCurrency';

/** Refund breakdown — derived from the ORIGINAL sale's snapshotted pricing. */
export function RefundSummaryCard({ lines, total }: { lines: Array<{ name: string; quantity: number; amount: number }>; total: number }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Refund summary</p>
      {lines.length === 0 ? (
        <p className="text-sm text-gray-500">Select item(s) to return.</p>
      ) : (
        <>
          <ul className="mb-2 space-y-1">
            {lines.map((l, i) => (
              <li key={i} className="flex justify-between text-sm text-gray-600 dark:text-gray-400"><span>{l.name} × {l.quantity}</span><span>{formatCurrency(l.amount)}</span></li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-2 text-base font-semibold text-gray-900 dark:text-gray-100"><span>Total refund</span><span>{formatCurrency(total)}</span></div>
        </>
      )}
    </div>
  );
}
