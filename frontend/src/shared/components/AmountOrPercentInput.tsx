import { TaxDiscountMode } from '../pricing/grnPricing';

/**
 * A numeric input paired with a %/₨ toggle, for values that can be entered either
 * as a percentage of some base or as a flat ("lumpsum") currency amount. Used for
 * GRN line- and invoice-level discount / sales tax / advance tax.
 */
export function AmountOrPercentInput({
  mode,
  value,
  onChange,
  className = '',
  ariaLabel,
  compact = false,
}: {
  mode: TaxDiscountMode;
  value: number;
  onChange: (mode: TaxDiscountMode, value: number) => void;
  className?: string;
  ariaLabel?: string;
  compact?: boolean;
}) {
  const width = compact ? 'w-16' : 'w-24';
  return (
    <div className={`inline-flex items-stretch overflow-hidden rounded-md border border-gray-300 dark:border-gray-700 ${className}`}>
      <input
        type="number"
        min="0"
        step="0.01"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(mode, Number(e.target.value))}
        aria-label={ariaLabel}
        className={`${width} bg-white dark:bg-gray-800 px-2 py-1 text-sm outline-none`}
      />
      <button
        type="button"
        onClick={() => onChange(mode === 'PERCENT' ? 'AMOUNT' : 'PERCENT', value)}
        title={mode === 'PERCENT' ? 'Percentage — click for flat amount' : 'Flat amount — click for percentage'}
        aria-label={`Switch to ${mode === 'PERCENT' ? 'flat amount' : 'percentage'}`}
        className="border-l border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        {mode === 'PERCENT' ? '%' : '₨'}
      </button>
    </div>
  );
}
