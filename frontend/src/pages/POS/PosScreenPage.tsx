import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { ApiClientError } from '../../shared/api/client';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { MedicinePicker } from '../../features/purchases/components/MedicinePicker';
import { useMedicineSearch } from '../../features/medicines/hooks/useMedicines';
import { useCartStore } from '../../features/pos/store/cartStore';
import { computeCart } from '../../features/pos/utils/cartCalculations';
import { posApi } from '../../features/pos/api/pos.api';

const ELEVATED = ['super_admin', 'admin', 'pharmacist'];

export function PosScreenPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { lines, addLine, setQty, removeLine, verifyPrescription, clear } = useCartStore();

  const sessionQ = useQuery({ queryKey: ['pos', 'session'], queryFn: async () => (await posApi.currentSession()).data });
  const [openingFloat, setOpeningFloat] = useState('');
  const [method, setMethod] = useState('CASH');
  const [tendered, setTendered] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ saleNumber: string; grandTotal: number; change: number } | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  const { grandTotal, subTotal, taxTotal } = computeCart(lines);
  const canElevate = ELEVATED.includes(user?.role ?? '');
  const unverifiedRx = lines.filter((l) => l.prescriptionRequired && !l.prescriptionVerifiedBy);

  const openSession = async () => {
    const f = Number(openingFloat);
    if (Number.isNaN(f) || f < 0) return;
    await posApi.openSession(f);
    qc.invalidateQueries({ queryKey: ['pos', 'session'] });
  };

  const verifyRx = async (medicineId: string) => {
    if (canElevate) return verifyPrescription(medicineId, user!.userId);
    const email = window.prompt('Pharmacist email to verify prescription:');
    const password = email ? window.prompt('Password:') : null;
    if (!email || !password) return;
    try {
      const res = await posApi.discountApproval(email, password); // reused elevated step-up auth
      verifyPrescription(medicineId, res.data.approverId);
    } catch (e) {
      alert(e instanceof ApiClientError ? e.message : 'Verification failed.');
    }
  };

  const finalize = async () => {
    setBanner(null);
    if (lines.length === 0) return;
    if (unverifiedRx.length) return setBanner('Verify all prescription-required items before payment.');
    const amount = grandTotal;
    const tenderedNum = method === 'CASH' ? Number(tendered || amount) : amount;
    if (method === 'CASH' && tenderedNum < amount) return setBanner('Tendered amount is less than the total.');
    setFinalizing(true);
    try {
      const res = await posApi.finalize({
        idempotencyKey: crypto.randomUUID(),
        items: lines.map((l) => ({ medicineId: l.medicineId, quantity: l.quantity, discountAmount: l.discountAmount, prescriptionVerifiedBy: l.prescriptionVerifiedBy })),
        payments: [{ method, amount, tenderedAmount: method === 'CASH' ? tenderedNum : undefined }],
      });
      setReceipt({ saleNumber: res.data.saleNumber, grandTotal: amount, change: method === 'CASH' ? Math.max(0, tenderedNum - amount) : 0 });
      clear();
      setTendered('');
      qc.invalidateQueries({ queryKey: ['pos', 'session'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['medicines'] });
    } catch (e) {
      setBanner(e instanceof ApiClientError ? e.message : 'Sale could not be completed — no charge was made.');
    } finally {
      setFinalizing(false);
    }
  };

  if (sessionQ.isLoading) return <p className="text-sm text-gray-500">Loading…</p>;

  // Session gate
  if (!sessionQ.data) {
    return (
      <div className="mx-auto max-w-sm rounded-lg border border-gray-200 dark:border-gray-800 p-6 text-center">
        <h1 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Open your session to start selling</h1>
        <p className="mb-4 text-sm text-gray-500">Enter your opening cash float.</p>
        <input type="number" min="0" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} placeholder="Opening float" className="mb-3 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
        <button onClick={openSession} className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Open Session</button>
      </div>
    );
  }

  const session = sessionQ.data;

  return (
    <div>
      {/* Session bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-800 dark:text-green-300">● Session open</span>
          <span className="text-gray-500">{session.salesCount} sales · {formatCurrency(session.salesTotal)}</span>
        </div>
        <button onClick={() => navigate('/pos/close')} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Close Session</button>
      </div>

      {banner && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{banner}</div>}
      {receipt && (
        <div className="mb-3 rounded-md border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-green-800 dark:text-green-300">✓ Sale {receipt.saleNumber} completed — {formatCurrency(receipt.grandTotal)}{receipt.change > 0 ? ` · change ${formatCurrency(receipt.change)}` : ''}</span>
            <button onClick={() => setReceipt(null)} className="text-green-700 dark:text-green-400 underline">New sale</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Cart */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
                <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 w-24">Qty</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Total</th><th></th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {lines.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-400">Scan or search to add items.</td></tr>}
                {lines.map((l) => (
                  <tr key={l.medicineId}>
                    <td className="px-3 py-2">
                      {l.name}
                      {l.prescriptionRequired && (
                        l.prescriptionVerifiedBy
                          ? <span className="ml-1 rounded bg-green-100 dark:bg-green-900/40 px-1 text-xs text-green-700 dark:text-green-300">℞ verified</span>
                          : <button onClick={() => verifyRx(l.medicineId)} className="ml-1 rounded bg-purple-100 dark:bg-purple-900/40 px-1 text-xs text-purple-700 dark:text-purple-300 underline">℞ verify</button>
                      )}
                      {l.currentStock !== undefined && l.quantity > l.currentStock && <span className="ml-1 text-xs text-orange-600">⚠ exceeds stock ({l.currentStock})</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setQty(l.medicineId, l.quantity - 1)} className="rounded border border-gray-300 dark:border-gray-700 px-1.5">−</button>
                        <input type="number" min="1" value={l.quantity} onChange={(e) => setQty(l.medicineId, Number(e.target.value))} className="w-12 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-center" />
                        <button onClick={() => setQty(l.medicineId, l.quantity + 1)} className="rounded border border-gray-300 dark:border-gray-700 px-1.5">+</button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(l.unitPrice)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(l.unitPrice * l.quantity - (l.discountAmount ?? 0))}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => removeLine(l.medicineId)} className="text-red-500">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-800 p-3 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatCurrency(subTotal)}</span></div>
            <div className="flex justify-between text-gray-500"><span>Tax</span><span>{formatCurrency(taxTotal)}</span></div>
            <div className="mt-1 flex justify-between text-lg font-semibold text-gray-900 dark:text-gray-100"><span>Grand Total</span><span>{formatCurrency(grandTotal)}</span></div>
          </div>
        </div>

        {/* Search + payment */}
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
            <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Add item</h2>
            <MedicineSearchAdd onAdd={addLine} />
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
            <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Payment</h2>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="mb-2 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm">
              {['CASH', 'CARD', 'MOBILE', 'WALLET', 'INSURANCE'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            {method === 'CASH' && (
              <div className="mb-2">
                <input type="number" min="0" value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder={`Tendered (total ${grandTotal})`} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm" />
                {tendered && Number(tendered) >= grandTotal && <p className="mt-1 text-sm text-green-600">Change: {formatCurrency(Number(tendered) - grandTotal)}</p>}
              </div>
            )}
            <button onClick={finalize} disabled={finalizing || lines.length === 0} className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {finalizing ? 'Finalizing…' : `Finalize · ${formatCurrency(grandTotal)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Search box that adds the picked medicine into the cart with live price/stock. */
function MedicineSearchAdd({ onAdd }: { onAdd: (line: import('../../features/pos/utils/cartCalculations').CartLine) => void }) {
  const [term, setTerm] = useState('');
  const { data } = useMedicineSearch(term);
  return (
    <div>
      <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Scan / search (F2)…" autoFocus className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm" />
      {term.trim().length >= 2 && (
        <ul className="mt-1 max-h-72 overflow-auto text-sm">
          {data?.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => { onAdd({ medicineId: m.id, name: m.name, unitPrice: m.sellingPrice, quantity: 1, taxRatePercent: m.taxRatePercent, taxInclusive: m.taxInclusive, currentStock: m.currentStock, prescriptionRequired: m.prescriptionRequired, controlled: m.controlled }); setTerm(''); }}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <span>{m.name} <span className="text-gray-400">· {m.sku}</span></span>
                <span className="text-gray-500">{m.sellingPrice} · stk {m.currentStock}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
