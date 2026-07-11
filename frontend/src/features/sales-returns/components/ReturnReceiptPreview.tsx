import { formatCurrency } from '../../dashboard/utils/formatCurrency';
import { REASON_LABELS, REFUND_LABELS } from '../types/sales-return.types';
import type { SalesReturnDetail } from '../types/sales-return.types';

/** Printable return receipt — mirrors Module 4's receipt conventions (spec §16). */
export function ReturnReceiptPreview({ ret }: { ret: SalesReturnDetail }) {
  return (
    <div className="mx-auto max-w-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-sm print:border-0">
      <div className="mb-2 text-center">
        <p className="text-base font-semibold">Return Receipt</p>
        <p className="font-mono text-xs">{ret.returnNumber}</p>
        <p className="text-xs text-gray-500">{new Date(ret.returnDate).toLocaleString()}</p>
      </div>
      <p className="text-xs text-gray-500">Against sale <span className="font-mono">{ret.originalSaleNumber ?? ret.originalSaleId}</span></p>
      <table className="my-2 w-full">
        <tbody>
          {ret.items.map((i) => (
            <tr key={i.id} className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1">{i.name} <span className="text-gray-400">×{i.quantityReturned}</span><br /><span className="text-[10px] text-gray-400">{REASON_LABELS[i.reasonCode]} · {i.conditionAssessment === 'RESALEABLE' ? 'restocked' : 'not resaleable'}</span></td>
              <td className="py-1 text-right">{formatCurrency(i.refundAmountForLine)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between font-semibold"><span>{REFUND_LABELS[ret.refundMethod]}</span><span>{formatCurrency(ret.totalRefundAmount)}</span></div>
      <button onClick={() => window.print()} className="mt-3 w-full rounded-md border border-gray-300 dark:border-gray-700 py-1.5 text-xs print:hidden">Print</button>
    </div>
  );
}
