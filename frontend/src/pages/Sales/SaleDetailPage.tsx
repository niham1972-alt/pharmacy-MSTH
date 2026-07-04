import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../shared/auth/AuthContext';
import { ApiClientError } from '../../shared/api/client';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { salesApi } from '../../features/pos/api/pos.api';

const CAN_VOID = ['super_admin', 'admin', 'pharmacist'];

export function SaleDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: sale, isLoading, isError, refetch } = useQuery({ queryKey: ['sales', 'detail', id], queryFn: async () => (await salesApi.detail(id!)).data, enabled: !!id });

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (isError || !sale) return <div className="text-center"><p className="text-sm text-red-600">Couldn't load sale.</p><button onClick={() => refetch()} className="mt-1 text-sm underline">Retry</button></div>;

  const canVoid = CAN_VOID.includes(user?.role ?? '') && sale.status === 'COMPLETED';
  const doVoid = async () => {
    const reason = window.prompt('Reason for voiding this sale?');
    if (!reason) return;
    try { await salesApi.void(sale.id, reason); qc.invalidateQueries({ queryKey: ['sales'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); refetch(); }
    catch (e) { alert(e instanceof ApiClientError ? e.message : 'Void failed.'); }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 text-sm text-gray-500"><Link to="/sales" className="underline">Sales</Link> / {sale.saleNumber}</div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{sale.saleNumber}</h1>
          <p className="text-sm text-gray-500">{new Date(sale.saleDate).toLocaleString()} · <span className={sale.status === 'VOIDED' ? 'text-red-600' : 'text-green-600'}>{sale.status.replace(/_/g, ' ')}</span></p>
          {sale.voidReason && <p className="text-xs text-red-500">Void reason: {sale.voidReason}</p>}
        </div>
        {canVoid && <button onClick={doVoid} className="rounded-md border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm text-red-600">Void Sale</button>}
      </div>

      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-gray-500"><tr><th className="py-1">Item</th><th>Qty</th><th>Unit</th><th className="text-right">Line</th></tr></thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {sale.items.map((i) => (
            <tr key={i.id}><td className="py-1.5">{i.name}<span className="text-gray-400"> · {i.sku}</span></td><td>{i.quantity}</td><td>{formatCurrency(i.unitPrice)}</td><td className="text-right">{formatCurrency(i.lineTotal)}</td></tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 max-w-xs ml-auto space-y-1 text-sm">
        <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatCurrency(sale.subTotal)}</span></div>
        <div className="flex justify-between text-gray-500"><span>Discount</span><span>{formatCurrency(sale.discountTotal)}</span></div>
        <div className="flex justify-between text-gray-500"><span>Tax</span><span>{formatCurrency(sale.taxTotal)}</span></div>
        <div className="flex justify-between font-semibold text-gray-900 dark:text-gray-100"><span>Grand Total</span><span>{formatCurrency(sale.grandTotal)}</span></div>
      </div>

      <div className="mt-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">Payments</h2>
        {sale.payments.map((p, i) => (
          <div key={i} className="flex justify-between text-sm text-gray-600 dark:text-gray-400"><span>{p.method}{p.tenderedAmount ? ` · tendered ${formatCurrency(p.tenderedAmount)}` : ''}</span><span>{formatCurrency(p.amount)}{p.changeDue ? ` · change ${formatCurrency(p.changeDue)}` : ''}</span></div>
        ))}
      </div>

      {sale.complianceRecords.length > 0 && (
        <div className="mt-4">
          <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">Compliance</h2>
          {sale.complianceRecords.map((c) => <p key={c.id} className="text-sm text-gray-500">{c.type}{c.patientName ? ` · ${c.patientName}` : ''}{c.isVoided ? ' (voided)' : ''}</p>)}
        </div>
      )}
    </div>
  );
}
