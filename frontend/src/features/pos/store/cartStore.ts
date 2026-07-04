import { create } from 'zustand';
import { CartLine } from '../utils/cartCalculations';

interface CartState {
  lines: CartLine[];
  customerId: string | null;
  addLine: (line: CartLine) => void;
  setQty: (medicineId: string, quantity: number) => void;
  setDiscount: (medicineId: string, discountAmount: number) => void;
  verifyPrescription: (medicineId: string, verifierId: string) => void;
  removeLine: (medicineId: string) => void;
  clear: () => void;
  load: (lines: CartLine[]) => void;
}

/** Local-first cart (spec §9): instant UI, only price-check/finalize hit the network. */
export const useCartStore = create<CartState>((set) => ({
  lines: [],
  customerId: null,
  addLine: (line) =>
    set((s) => {
      const existing = s.lines.find((l) => l.medicineId === line.medicineId);
      if (existing) return { lines: s.lines.map((l) => (l.medicineId === line.medicineId ? { ...l, quantity: l.quantity + 1 } : l)) };
      return { lines: [...s.lines, { ...line, quantity: line.quantity || 1 }] };
    }),
  setQty: (medicineId, quantity) => set((s) => ({ lines: s.lines.map((l) => (l.medicineId === medicineId ? { ...l, quantity: Math.max(1, quantity) } : l)) })),
  setDiscount: (medicineId, discountAmount) => set((s) => ({ lines: s.lines.map((l) => (l.medicineId === medicineId ? { ...l, discountAmount: Math.max(0, discountAmount) } : l)) })),
  verifyPrescription: (medicineId, verifierId) => set((s) => ({ lines: s.lines.map((l) => (l.medicineId === medicineId ? { ...l, prescriptionVerifiedBy: verifierId } : l)) })),
  removeLine: (medicineId) => set((s) => ({ lines: s.lines.filter((l) => l.medicineId !== medicineId) })),
  clear: () => set({ lines: [], customerId: null }),
  load: (lines) => set({ lines }),
}));
