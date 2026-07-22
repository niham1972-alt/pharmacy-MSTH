import { exceedsDeviation, needsApproval, requiresApproval } from '../expense-threshold';

describe('expense approval threshold', () => {
  const THRESHOLD = 25000;

  it('is payable directly at or under the threshold', () => {
    expect(requiresApproval(25000, THRESHOLD)).toBe(false); // boundary inclusive
    expect(requiresApproval(500, THRESHOLD)).toBe(false);
  });

  it('routes an above-threshold expense to approval', () => {
    expect(requiresApproval(25001, THRESHOLD)).toBe(true);
    expect(requiresApproval(150000, THRESHOLD)).toBe(true);
  });
});

describe('recurring deviation flag (spec §11/§21)', () => {
  const DEVIATION = 25; // percent

  it('flags an amount that overshoots the template default by more than the deviation', () => {
    expect(exceedsDeviation(70000, 50000, DEVIATION)).toBe(true); // rent 50k suddenly 70k (+40%)
  });

  it('does not flag an amount within the allowed deviation band', () => {
    expect(exceedsDeviation(60000, 50000, DEVIATION)).toBe(false); // +20% ≤ 25%
    expect(exceedsDeviation(62500, 50000, DEVIATION)).toBe(false); // exactly +25% (boundary)
  });

  it('gives no deviation signal for variable (no-default) templates', () => {
    expect(exceedsDeviation(999999, null, DEVIATION)).toBe(false);
    expect(exceedsDeviation(999999, 0, DEVIATION)).toBe(false);
  });
});

describe('needsApproval (combined decision)', () => {
  it('requires approval when over the flat threshold', () => {
    expect(needsApproval({ amount: 30000, threshold: 25000, defaultAmount: null, deviationPercent: 25 })).toBe(true);
  });

  it('requires approval on an under-threshold but deviating recurring instance', () => {
    // 20k is under the 25k threshold, but it's +100% over the 10k template default.
    expect(needsApproval({ amount: 20000, threshold: 25000, defaultAmount: 10000, deviationPercent: 25 })).toBe(true);
  });

  it('needs no approval for a small, on-pattern expense', () => {
    expect(needsApproval({ amount: 5000, threshold: 25000, defaultAmount: 5000, deviationPercent: 25 })).toBe(false);
  });
});
