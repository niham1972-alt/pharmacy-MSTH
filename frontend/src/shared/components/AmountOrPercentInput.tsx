import { TaxDiscountMode } from '../pricing/grnPricing';

/**
 * A numeric input paired with an explicit two-option %/Rs segmented toggle, for
 * values that can be entered either as a percentage of a base amount or as a flat
 * ("lumpsum") currency amount. The active mode is highlighted so it's obvious the
 * value can be switched. Used for GRN line- and invoice-level discount / sales tax
 * / advance tax. Pass `base` to show the resolved currency amount as a hint.
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
  const width = compact ? 'w-14' : 'w-24';
  const seg = (m: TaxDiscountMode, label: string) => (
    <button
      type="button"
      onClick={() => onChange(m, value)}
      aria-pressed={mode === m}
      aria-label={`${ariaLabel ?? 'value'} as ${m === 'PERCENT' ? 'percentage' : 'flat amount'}`}
      className={`px-1.5 text-xs font-semibold ${
        mode === m
          ? 'bg-brand-600 text-white'
          : 'bg-gray-50 dark:bg-gray-900 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  );
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
      <div className="flex flex-col border-l border-gray-300 dark:border-gray-700 divide-y divide-gray-300 dark:divide-gray-700">
        {seg('PERCENT', '%')}
        {seg('AMOUNT', '₨')}
      </div>
    </div>
  );
}
