/** Never renders a literal "Infinity" — the backend already collapses that case to `'new'`. */
export function formatPercentChange(changePct: number | 'new' | undefined): string {
  if (changePct === undefined) return '';
  if (changePct === 'new') return 'New';
  const sign = changePct > 0 ? '+' : '';
  return `${sign}${changePct}%`;
}

export function percentChangeDirection(changePct: number | 'new' | undefined): 'up' | 'down' | 'flat' {
  if (changePct === undefined || changePct === 'new') return 'flat';
  if (changePct > 0) return 'up';
  if (changePct < 0) return 'down';
  return 'flat';
}
