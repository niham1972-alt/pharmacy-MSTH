import { useState } from 'react';
import { CartLine } from '../utils/cartCalculations';

/** Controlled-substance compliance capture (spec §2.1 / §10). Cannot be
 * dismissed accidentally — explicit Cancel or Save required. */
export function ComplianceModal({ line, onSave, onCancel }: { line: CartLine; onSave: (c: NonNullable<CartLine['compliance']>) => void; onCancel: () => void }) {
  const [prescribingDoctor, setDoctor] = useState(line.compliance?.prescribingDoctor ?? '');
  const [patientName, setPatient] = useState(line.compliance?.patientName ?? '');
  const [patientIdNumber, setPatientId] = useState(line.compliance?.patientIdNumber ?? '');
  const [quantityDispensed, setQty] = useState(line.compliance?.quantityDispensed ?? line.quantity);

  const valid = prescribingDoctor.trim() && patientName.trim() && quantityDispensed > 0;
  const input = 'w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-lg bg-white dark:bg-gray-900 p-5 shadow-xl">
        <h2 className="mb-1 text-sm font-semibold text-red-700 dark:text-red-300">Controlled Substance — {line.name}</h2>
        <p className="mb-3 text-xs text-gray-500">Regulatory record required before this item can be sold.</p>
        <div className="space-y-2">
          <label className="block"><span className="text-xs text-gray-500">Prescribing doctor *</span><input className={input} value={prescribingDoctor} onChange={(e) => setDoctor(e.target.value)} /></label>
          <label className="block"><span className="text-xs text-gray-500">Patient name *</span><input className={input} value={patientName} onChange={(e) => setPatient(e.target.value)} /></label>
          <label className="block"><span className="text-xs text-gray-500">Patient ID</span><input className={input} value={patientIdNumber} onChange={(e) => setPatientId(e.target.value)} /></label>
          <label className="block"><span className="text-xs text-gray-500">Quantity dispensed *</span><input type="number" min="1" className={input} value={quantityDispensed} onChange={(e) => setQty(Number(e.target.value))} /></label>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm">Cancel</button>
          <button onClick={() => onSave({ prescribingDoctor, patientName, patientIdNumber, quantityDispensed })} disabled={!valid} className="flex-1 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  );
}
