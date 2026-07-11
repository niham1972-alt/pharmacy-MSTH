import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { REASON_LABELS } from '../types/purchase-return.types';
import type { PurchaseReturnDetail } from '../types/purchase-return.types';

/** Printable "Return to Supplier" document (mirrors Module 3's GRN conventions). */
export function ReturnDocumentPreview({ ret }: { ret: PurchaseReturnDetail }) {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-sm print:border-0">
      <div className="mb-2 text-center">
        <p className="text-base font-semibold">Return to Supplier</p>
        <p className="font-mono text-xs">{ret.returnNumber}</p>
        <p className="text-xs text-gray-500">{new Date(ret.returnDate).toLocaleString()}</p>
      </div>
      <div className="mb-2 text-xs text-gray-500">
        <p>Supplier: <span className="text-gray-700 dark:text-gray-300">{ret.supplierName ?? ret.supplierId}</span></p>
        <p>Against GRN: <span className="font-mono">{ret.originalGrnNumber ?? ret.originalGrnId}</span></p>
      </div>
      <table className="my-2 w-full">
        <thead><tr className="border-b border-gray-200 text-left text-[10px] uppercase text-gray-400 dark:border-gray-700"><th className="py-1">Item / batch</th><th>Qty</th><th className="text-right">Credit</th></tr></thead>
        <tbody>
          {ret.items.map((i) => (
            <tr key={i.id} className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1">{i.name}<br /><span className="text-[10px] text-gray-400">{REASON_LABELS[i.reasonCode]}</span></td>
              <td>{i.quantityReturned}</td>
              <td className="text-right">{formatCurrency(i.lineCredit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between font-semibold"><span>Expected credit</span><span>{formatCurrency(ret.expectedCreditAmount)}</span></div>
      <button onClick={() => window.print()} className="mt-3 w-full rounded-md border border-gray-300 dark:border-gray-700 py-1.5 text-xs print:hidden">Print</button>
    </div>
  );
}
