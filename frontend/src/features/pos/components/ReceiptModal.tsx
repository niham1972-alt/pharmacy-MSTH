import { formatCurrency } from '../../dashboard/utils/formatCurrency';

export interface ReceiptData {
  saleNumber: string;
  dateTime: string;
  cashier: string;
  customerName: string | null;
  lines: Array<{ name: string; quantity: number; unitPrice: number; discount: number; lineTotal: number }>;
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  payments: Array<{ method: string; amount: number }>;
  change: number;
}

export function ReceiptModal({ receipt, onNewSale }: { receipt: ReceiptData; onNewSale: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-lg bg-white dark:bg-gray-900 shadow-xl">
        {/* Printable area */}
        <div id="receipt" className="max-h-[70vh] overflow-auto p-5 text-sm text-gray-900 dark:text-gray-100">
          <div className="mb-3 text-center">
            <div className="text-lg font-bold">Pharmacy MS</div>
            <div className="text-xs text-gray-500">Sales Receipt</div>
          </div>
          <div className="mb-2 flex justify-between text-xs text-gray-500">
            <span>{receipt.saleNumber}</span>
            <span>{new Date(receipt.dateTime).toLocaleString()}</span>
          </div>
          <div className="mb-2 text-xs text-gray-500">Cashier: {receipt.cashier}{receipt.customerName ? ` · Customer: ${receipt.customerName}` : ''}</div>
          <table className="w-full border-t border-dashed border-gray-300 dark:border-gray-700 pt-1">
            <thead><tr className="text-left text-xs text-gray-400"><th className="py-1">Item</th><th className="text-center">Qty</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {receipt.lines.map((l, i) => (
                <tr key={i} className="align-top">
                  <td className="py-0.5">{l.name}{l.discount > 0 && <span className="block text-xs text-gray-400">disc {formatCurrency(l.discount)}</span>}</td>
                  <td className="text-center">{l.quantity}</td>
                  <td className="text-right">{formatCurrency(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 space-y-0.5 border-t border-dashed border-gray-300 dark:border-gray-700 pt-2 text-xs">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(receipt.subTotal + receipt.discountTotal)}</span></div>
            {receipt.discountTotal > 0 && <div className="flex justify-between"><span>Discount</span><span>−{formatCurrency(receipt.discountTotal)}</span></div>}
            <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(receipt.taxTotal)}</span></div>
            <div className="flex justify-between text-sm font-semibold"><span>Grand Total</span><span>{formatCurrency(receipt.grandTotal)}</span></div>
          </div>
          <div className="mt-2 space-y-0.5 border-t border-dashed border-gray-300 dark:border-gray-700 pt-2 text-xs">
            {receipt.payments.map((p, i) => <div key={i} className="flex justify-between"><span>{p.method}</span><span>{formatCurrency(p.amount)}</span></div>)}
            {receipt.change > 0 && <div className="flex justify-between font-medium"><span>Change</span><span>{formatCurrency(receipt.change)}</span></div>}
          </div>
          <p className="mt-3 text-center text-xs text-gray-400">Thank you for your purchase</p>
        </div>

        <div className="flex gap-2 border-t border-gray-200 dark:border-gray-800 p-3">
          <button onClick={() => window.print()} className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm">🖨 Print</button>
          <button onClick={onNewSale} className="flex-1 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white">New Sale</button>
        </div>
      </div>
    </div>
  );
}
