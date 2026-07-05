import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { ApiClientError } from '../../shared/api/client';
import { formatCurrency } from '../../features/dashboard/utils/formatCurrency';
import { useMedicineSearch, useMedicinesList } from '../../features/medicines/hooks/useMedicines';
import { useCartStore } from '../../features/pos/store/cartStore';
import { buildCart, discountPercent, CartLine } from '../../features/pos/utils/cartCalculations';
import { posApi } from '../../features/pos/api/pos.api';
import { CustomerSelector } from '../../features/pos/components/CustomerSelector';
import { SplitPaymentEditor, PaymentLine } from '../../features/pos/components/SplitPaymentEditor';
import { ReceiptModal, ReceiptData } from '../../features/pos/components/ReceiptModal';
import { ComplianceModal } from '../../features/pos/components/ComplianceModal';

const ELEVATED = ['super_admin', 'admin', 'pharmacist'];
const AUTO_DISCOUNT_PCT = 5; // mirrors backend POS_AUTO_DISCOUNT_PCT

export function PosScreenPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const store = useCartStore();
  const { lines, cartDiscount } = store;

  const sessionQ = useQuery({ queryKey: ['pos', 'session'], queryFn: async () => (await posApi.currentSession()).data });
  const parkedQ = useQuery({ queryKey: ['pos', 'parked'], queryFn: async () => (await posApi.listParked()).data, enabled: !!sessionQ.data });

  const [openingFloat, setOpeningFloat] = useState('');
  const [payments, setPayments] = useState<PaymentLine[]>([{ method: 'CASH', amount: 0 }]);
  const [discountApprovedBy, setDiscountApprovedBy] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [showParked, setShowParked] = useState(false);
  const [complianceFor, setComplianceFor] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const canElevate = ELEVATED.includes(user?.role ?? '');
  const { finalLines, totals } = useMemo(() => buildCart(lines, cartDiscount), [lines, cartDiscount]);
  const discPct = useMemo(() => discountPercent(lines, cartDiscount), [lines, cartDiscount]);
  const needsApproval = discPct > AUTO_DISCOUNT_PCT && !canElevate && !discountApprovedBy;

  // Keep a single payment line synced to the grand total (frictionless common case).
  useEffect(() => {
    setPayments((ps) => (ps.length <= 1 ? [{ ...(ps[0] ?? { method: 'CASH' }), amount: totals.grandTotal }] : ps));
  }, [totals.grandTotal]);

  // Debounced price-check → authoritative stock + FEFO batch per line.
  useEffect(() => {
    if (lines.length === 0) return;
    const h = setTimeout(() => {
      posApi
        .priceCheck(lines.map((l) => ({ medicineId: l.medicineId, quantity: l.quantity })))
        .then((r) => {
          const map: Record<string, { fefoBatch: CartLine['fefoBatch']; currentStock: number }> = {};
          for (const pl of r.data.lines) map[pl.medicineId] = { fefoBatch: pl.fefoBatch, currentStock: pl.currentStock };
          store.mergeBatchInfo(map);
        })
        .catch(() => undefined);
    }, 350);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(lines.map((l) => [l.medicineId, l.quantity]))]);

  const paid = Math.round(payments.reduce((s, p) => s + (p.amount || 0), 0) * 100) / 100;
  const unverifiedRx = finalLines.filter((l) => l.prescriptionRequired && !l.prescriptionVerifiedBy);
  const unfilledControlled = finalLines.filter((l) => l.controlled && !(l.compliance?.prescribingDoctor && l.compliance?.patientName));
  const overStock = finalLines.filter((l) => l.currentStock !== undefined && l.quantity > l.currentStock);
  const canFinalize = lines.length > 0 && unverifiedRx.length === 0 && unfilledControlled.length === 0 && !needsApproval && paid === totals.grandTotal;

  const openSession = async () => {
    const f = Number(openingFloat);
    if (Number.isNaN(f) || f < 0) return;
    await posApi.openSession(f);
    qc.invalidateQueries({ queryKey: ['pos', 'session'] });
  };

  const stepUp = async (label: string): Promise<string | null> => {
    const email = window.prompt(`${label} — approver email:`);
    const password = email ? window.prompt('Password:') : null;
    if (!email || !password) return null;
    try {
      const res = await posApi.discountApproval(email, password);
      return res.data.approverId;
    } catch (e) {
      alert(e instanceof ApiClientError ? e.message : 'Authorization failed.');
      return null;
    }
  };

  const verifyRx = async (medicineId: string) => {
    if (canElevate) return store.verifyPrescription(medicineId, user!.userId);
    const approver = await stepUp('Verify prescription (pharmacist)');
    if (approver) store.verifyPrescription(medicineId, approver);
  };

  const approveDiscount = async () => {
    const approver = await stepUp('Approve discount (manager)');
    if (approver) setDiscountApprovedBy(approver);
  };

  const clearAll = () => {
    if (lines.length && !window.confirm('Clear the entire cart?')) return;
    store.clear();
    setPayments([{ method: 'CASH', amount: 0 }]);
    setDiscountApprovedBy(null);
  };

  const parkSale = async () => {
    if (lines.length === 0) return;
    const label = window.prompt('Label for this parked sale (optional):') ?? undefined;
    await posApi.park(label || store.customerName || undefined, { lines, customerId: store.customerId, customerName: store.customerName, cartDiscount });
    store.clear();
    setPayments([{ method: 'CASH', amount: 0 }]);
    qc.invalidateQueries({ queryKey: ['pos', 'parked'] });
  };

  const resumeParked = async (id: string, snap: unknown) => {
    const s = snap as { lines: CartLine[]; customerId: string | null; customerName: string | null; cartDiscount: typeof cartDiscount };
    store.restore({ lines: s.lines, customerId: s.customerId, customerName: s.customerName, cartDiscount: s.cartDiscount });
    await posApi.discardParked(id);
    qc.invalidateQueries({ queryKey: ['pos', 'parked'] });
    setShowParked(false);
  };

  const finalize = async () => {
    setBanner(null);
    if (!canFinalize) return;
    setFinalizing(true);
    const cashPaid = payments.filter((p) => p.method === 'CASH');
    const change = cashPaid.reduce((s, p) => s + Math.max(0, (p.tenderedAmount ?? p.amount) - p.amount), 0);
    try {
      const res = await posApi.finalize({
        idempotencyKey: crypto.randomUUID(),
        customerId: store.customerId ?? undefined,
        discountApprovedBy: discountApprovedBy ?? undefined,
        items: finalLines.map((l) => ({ medicineId: l.medicineId, quantity: l.quantity, discountAmount: l.discountAmount, prescriptionVerifiedBy: l.prescriptionVerifiedBy })),
        payments: payments.map((p) => ({ method: p.method, amount: p.amount, tenderedAmount: p.method === 'CASH' ? p.tenderedAmount : undefined, referenceNumber: p.referenceNumber })),
        compliance: finalLines.filter((l) => l.controlled).map((l) => ({ medicineId: l.medicineId, type: 'CONTROLLED_SUBSTANCE', prescribingDoctor: l.compliance?.prescribingDoctor, patientName: l.compliance?.patientName, patientIdNumber: l.compliance?.patientIdNumber, quantityDispensed: l.compliance?.quantityDispensed ?? l.quantity })),
      });
      setReceipt({
        saleNumber: res.data.saleNumber,
        dateTime: new Date().toISOString(),
        cashier: user?.email ?? user?.userId ?? '',
        customerName: store.customerName,
        lines: finalLines.map((l) => ({ name: l.name, quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discountAmount, lineTotal: l.lineTotal })),
        subTotal: totals.subTotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        payments: payments.map((p) => ({ method: p.method, amount: p.amount })),
        change: Math.round(change * 100) / 100,
      });
      store.clear();
      setPayments([{ method: 'CASH', amount: 0 }]);
      setDiscountApprovedBy(null);
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

  if (!sessionQ.data) {
    return (
      <div className="mx-auto max-w-sm rounded-lg border border-gray-200 dark:border-gray-800 p-6 text-center">
        <h1 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Open your session to start selling</h1>
        <p className="mb-4 text-sm text-gray-500">Enter the opening cash float in your drawer (for giving change).</p>
        <input type="number" min="0" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} placeholder="e.g. 2000" className="mb-3 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
        <button onClick={openSession} className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Open Session</button>
      </div>
    );
  }

  const session = sessionQ.data;

  return (
    <div>
      {receipt && <ReceiptModal receipt={receipt} onNewSale={() => setReceipt(null)} />}
      {complianceFor && (
        <ComplianceModal
          line={lines.find((l) => l.medicineId === complianceFor)!}
          onSave={(c) => { store.setCompliance(complianceFor, c); setComplianceFor(null); }}
          onCancel={() => setComplianceFor(null)}
        />
      )}

      {/* Session bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-800 dark:text-green-300">● Session open</span>
          <span className="text-gray-500">{session.salesCount} sales · {formatCurrency(session.salesTotal)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowParked((s) => !s)} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Parked ({parkedQ.data?.length ?? 0})</button>
          <button onClick={() => navigate('/pos/close')} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Close Session</button>
        </div>
      </div>

      {showParked && (
        <div className="mb-3 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <h2 className="mb-2 text-sm font-semibold">Parked Sales</h2>
          {(parkedQ.data?.length ?? 0) === 0 && <p className="text-sm text-gray-500">No parked sales — hold a cart to see it here.</p>}
          {parkedQ.data?.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 py-1.5 text-sm">
              <span>{p.label ?? 'Untitled'} <span className="text-gray-400">· {new Date(p.createdAt).toLocaleTimeString()}</span></span>
              <div className="flex gap-2">
                <button onClick={() => resumeParked(p.id, p.cartSnapshot)} className="text-brand-600 dark:text-brand-400 underline">Resume</button>
                <button onClick={async () => { await posApi.discardParked(p.id); qc.invalidateQueries({ queryKey: ['pos', 'parked'] }); }} className="text-red-500 underline">Discard</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {banner && <div role="alert" className="mb-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">{banner}</div>}

      <div className="mb-3"><CustomerSelector customerName={store.customerName} onSelect={store.setCustomer} /></div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Cart */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-500">
                <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 w-28">Qty</th><th className="px-3 py-2 w-24">Disc</th><th className="px-3 py-2 text-right">Total</th><th></th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {lines.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-400">Scan or search to add items.</td></tr>}
                {finalLines.map((l) => (
                  <tr key={l.medicineId}>
                    <td className="px-3 py-2">
                      <div>
                        {l.name}
                        {l.prescriptionRequired && (l.prescriptionVerifiedBy
                          ? <span className="ml-1 rounded bg-green-100 dark:bg-green-900/40 px-1 text-xs text-green-700 dark:text-green-300">℞ verified</span>
                          : <button onClick={() => verifyRx(l.medicineId)} className="ml-1 rounded bg-purple-100 dark:bg-purple-900/40 px-1 text-xs text-purple-700 dark:text-purple-300 underline">℞ Required — Verify</button>)}
                        {l.controlled && (l.compliance?.prescribingDoctor
                          ? <span className="ml-1 rounded bg-green-100 dark:bg-green-900/40 px-1 text-xs text-green-700 dark:text-green-300">✓ compliance</span>
                          : <button onClick={() => setComplianceFor(l.medicineId)} className="ml-1 rounded bg-red-100 dark:bg-red-900/40 px-1 text-xs text-red-700 dark:text-red-300 underline">Controlled — Fill form</button>)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {l.currentStock !== undefined && <span className={l.quantity > l.currentStock ? 'text-orange-600' : ''}>{l.quantity > l.currentStock ? '⚠ ' : ''}{l.currentStock} in stock</span>}
                        {l.fefoBatch && <span> · Batch {l.fefoBatch.batchNumber} · Exp {new Date(l.fefoBatch.expiryDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => store.setQty(l.medicineId, l.quantity - 1)} className="rounded border border-gray-300 dark:border-gray-700 px-1.5">−</button>
                        <input type="number" min="1" value={l.quantity} onChange={(e) => store.setQty(l.medicineId, Number(e.target.value))} className="w-12 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-center" aria-label="Quantity" />
                        <button onClick={() => store.setQty(l.medicineId, l.quantity + 1)} className="rounded border border-gray-300 dark:border-gray-700 px-1.5">+</button>
                      </div>
                    </td>
                    <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={l.lineDiscount ?? 0} onChange={(e) => store.setLineDiscount(l.medicineId, Number(e.target.value))} className="w-16 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5" aria-label="Line discount" /></td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(l.lineTotal)}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => store.removeLine(l.medicineId)} className="text-red-500" aria-label="Remove line">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lines.length > 0 && (
              <div className="flex justify-end border-t border-gray-100 dark:border-gray-800 p-2">
                <button onClick={clearAll} className="text-xs text-red-600 dark:text-red-400 underline">Clear Cart</button>
              </div>
            )}
          </div>

          {/* Cart discount + totals */}
          <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-800 p-3 text-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">Cart discount</span>
              <select value={cartDiscount.type} onChange={(e) => store.setCartDiscount({ ...cartDiscount, type: e.target.value as 'pct' | 'fixed' })} className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-0.5 text-xs">
                <option value="pct">%</option>
                <option value="fixed">Rs</option>
              </select>
              <input type="number" min="0" value={cartDiscount.value} onChange={(e) => { store.setCartDiscount({ ...cartDiscount, value: Number(e.target.value) }); setDiscountApprovedBy(null); }} className="w-20 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-0.5 text-xs" aria-label="Cart discount value" />
              {needsApproval && <button onClick={approveDiscount} className="rounded bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 text-xs text-orange-700 dark:text-orange-300 underline">Requires approval</button>}
              {discountApprovedBy && <span className="text-xs text-green-600">✓ approved</span>}
            </div>
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatCurrency(totals.subTotal + totals.discountTotal)}</span></div>
            {totals.discountTotal > 0 && <div className="flex justify-between text-gray-500"><span>Discount</span><span>−{formatCurrency(totals.discountTotal)}</span></div>}
            <div className="flex justify-between text-gray-500"><span>Tax</span><span>{formatCurrency(totals.taxTotal)}</span></div>
            <div className="mt-1 flex justify-between text-lg font-semibold text-gray-900 dark:text-gray-100"><span>Grand Total</span><span>{formatCurrency(totals.grandTotal)}</span></div>
          </div>
        </div>

        {/* Search + payment */}
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
            <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Add item</h2>
            <SearchAdd searchRef={searchRef} onAdd={store.addLine} />
            <QuickPick onAdd={store.addLine} />
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
            <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Payment</h2>
            <SplitPaymentEditor grandTotal={totals.grandTotal} payments={payments} onChange={setPayments} />
            <button onClick={finalize} disabled={finalizing || !canFinalize} className="mt-3 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {finalizing ? 'Finalizing…' : `Finalize · ${formatCurrency(totals.grandTotal)}`}
            </button>
            {lines.length > 0 && !canFinalize && (
              <p className="mt-1 text-xs text-orange-600">
                {unverifiedRx.length ? 'Verify all ℞ items. ' : ''}
                {unfilledControlled.length ? 'Complete controlled-substance forms. ' : ''}
                {needsApproval ? 'Discount needs approval. ' : ''}
                {overStock.length ? 'Some items exceed stock. ' : ''}
                {paid !== totals.grandTotal ? 'Payments must equal grand total.' : ''}
              </p>
            )}
            <button onClick={parkSale} disabled={lines.length === 0} className="mt-2 w-full rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm disabled:opacity-50">Park Sale</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Search box — refocuses after each add so a barcode scanner always lands here. */
function SearchAdd({ onAdd, searchRef }: { onAdd: (l: CartLine) => void; searchRef: React.RefObject<HTMLInputElement> }) {
  const [term, setTerm] = useState('');
  const { data } = useMedicineSearch(term);
  const addAndRefocus = (l: CartLine) => { onAdd(l); setTerm(''); searchRef.current?.focus(); };
  const toLine = (m: import('../../features/medicines/types/medicine.types').MedicineSearchResult): CartLine => ({ medicineId: m.id, name: m.name, unitPrice: m.sellingPrice, quantity: 1, taxRatePercent: m.taxRatePercent, taxInclusive: m.taxInclusive, currentStock: m.currentStock, prescriptionRequired: m.prescriptionRequired, controlled: m.controlled });

  return (
    <div>
      <input
        ref={searchRef}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && data && data.length === 1) addAndRefocus(toLine(data[0])); }}
        placeholder="Scan / search (F2)…"
        autoFocus
        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
      />
      {term.trim().length >= 2 && (
        <ul className="mt-1 max-h-60 overflow-auto text-sm">
          {data?.map((m) => (
            <li key={m.id}>
              <button onClick={() => addAndRefocus(toLine(m))} className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800">
                <span>{m.name} <span className="text-gray-400">· {m.sku}</span>{m.discontinued && <span className="ml-1 rounded bg-amber-100 dark:bg-amber-900/40 px-1 text-xs text-amber-700 dark:text-amber-300">Discontinued</span>}</span>
                <span className="text-gray-500">{m.sellingPrice} · stk {m.currentStock}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Frequently-sold quick-pick tiles for fast add without typing (spec §5). */
function QuickPick({ onAdd }: { onAdd: (l: CartLine) => void }) {
  const { data } = useMedicinesList({ page: 1, limit: 8, sortBy: 'stock', sortOrder: 'desc' });
  const tiles = data?.data ?? [];
  if (tiles.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="mb-1 text-xs text-gray-400">Quick pick</p>
      <div className="flex flex-wrap gap-1">
        {tiles.map((m) => (
          <button
            key={m.id}
            onClick={() => onAdd({ medicineId: m.id, name: m.name, unitPrice: m.sellingPrice, quantity: 1, taxRatePercent: m.taxRatePercent, currentStock: m.currentStock, prescriptionRequired: m.prescriptionRequired, controlled: !!m.controlledSubstanceSchedule })}
            className="rounded-full border border-gray-300 dark:border-gray-700 px-2 py-0.5 text-xs hover:border-brand-500"
          >
            {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}
