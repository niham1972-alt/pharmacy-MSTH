import { create } from 'zustand';
import { CartDiscount, CartLine } from '../utils/cartCalculations';

export interface CartSnapshot {
  lines: CartLine[];
  customerId: string | null;
  customerName: string | null;
  cartDiscount: CartDiscount;
}

interface CartState extends CartSnapshot {
  addLine: (line: CartLine) => void;
  setQty: (medicineId: string, quantity: number) => void;
  setLineDiscount: (medicineId: string, lineDiscount: number) => void;
  verifyPrescription: (medicineId: string, verifierId: string) => void;
  setCompliance: (medicineId: string, compliance: CartLine['compliance']) => void;
  mergeBatchInfo: (info: Record<string, { fefoBatch: CartLine['fefoBatch']; currentStock: number }>) => void;
  removeLine: (medicineId: string) => void;
  setCartDiscount: (d: CartDiscount) => void;
  setCustomer: (id: string | null, name: string | null) => void;
  clear: () => void;
  restore: (snap: CartSnapshot) => void;
}

const EMPTY_DISCOUNT: CartDiscount = { type: 'pct', value: 0 };

/** Local-first cart (spec §9): instant UI, only price-check/finalize hit the network. */
export const useCartStore = create<CartState>((set) => ({
  lines: [],
  customerId: null,
  customerName: null,
  cartDiscount: EMPTY_DISCOUNT,
  addLine: (line) =>
    set((s) => {
      const existing = s.lines.find((l) => l.medicineId === line.medicineId);
      if (existing) return { lines: s.lines.map((l) => (l.medicineId === line.medicineId ? { ...l, quantity: l.quantity + 1 } : l)) };
      return { lines: [...s.lines, { ...line, quantity: line.quantity || 1 }] };
    }),
  setQty: (medicineId, quantity) => set((s) => ({ lines: s.lines.map((l) => (l.medicineId === medicineId ? { ...l, quantity: Math.max(1, quantity) } : l)) })),
  setLineDiscount: (medicineId, lineDiscount) => set((s) => ({ lines: s.lines.map((l) => (l.medicineId === medicineId ? { ...l, lineDiscount: Math.max(0, lineDiscount) } : l)) })),
  verifyPrescription: (medicineId, verifierId) => set((s) => ({ lines: s.lines.map((l) => (l.medicineId === medicineId ? { ...l, prescriptionVerifiedBy: verifierId } : l)) })),
  setCompliance: (medicineId, compliance) => set((s) => ({ lines: s.lines.map((l) => (l.medicineId === medicineId ? { ...l, compliance } : l)) })),
  mergeBatchInfo: (info) => set((s) => ({ lines: s.lines.map((l) => (info[l.medicineId] ? { ...l, fefoBatch: info[l.medicineId].fefoBatch, currentStock: info[l.medicineId].currentStock } : l)) })),
  removeLine: (medicineId) => set((s) => ({ lines: s.lines.filter((l) => l.medicineId !== medicineId) })),
  setCartDiscount: (cartDiscount) => set({ cartDiscount }),
  setCustomer: (customerId, customerName) => set({ customerId, customerName }),
  clear: () => set({ lines: [], customerId: null, customerName: null, cartDiscount: EMPTY_DISCOUNT }),
  restore: (snap) => set({ lines: snap.lines, customerId: snap.customerId, customerName: snap.customerName, cartDiscount: snap.cartDiscount ?? EMPTY_DISCOUNT }),
}));
