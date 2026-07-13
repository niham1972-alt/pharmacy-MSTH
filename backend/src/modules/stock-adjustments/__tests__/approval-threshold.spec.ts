import { isAutoApproved } from '../adjustment-threshold';

describe('isAutoApproved (adjustment threshold)', () => {
  const MAX_QTY = 10;
  const MAX_VALUE = 5000;

  it('auto-approves a small adjustment within both caps', () => {
    expect(isAutoApproved(2, 200, MAX_QTY, MAX_VALUE)).toBe(true); // 2 broken bottles
  });

  it('requires approval when quantity exceeds the cap (even if value is small)', () => {
    expect(isAutoApproved(50, 500, MAX_QTY, MAX_VALUE)).toBe(false); // 50 units missing
  });

  it('requires approval when value exceeds the cap (even if quantity is small)', () => {
    expect(isAutoApproved(3, 9000, MAX_QTY, MAX_VALUE)).toBe(false); // 3 very expensive units
  });

  it('requires approval when BOTH exceed', () => {
    expect(isAutoApproved(100, 50000, MAX_QTY, MAX_VALUE)).toBe(false);
  });

  it('treats the cap boundary as inclusive (auto-approve exactly at the cap)', () => {
    expect(isAutoApproved(10, 5000, MAX_QTY, MAX_VALUE)).toBe(true);
    expect(isAutoApproved(11, 5000, MAX_QTY, MAX_VALUE)).toBe(false);
    expect(isAutoApproved(10, 5001, MAX_QTY, MAX_VALUE)).toBe(false);
  });
});
