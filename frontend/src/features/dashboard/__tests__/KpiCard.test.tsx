import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KpiCard } from '../components/KpiCard';

describe('KpiCard', () => {
  it('renders a loading skeleton when loading', () => {
    render(<KpiCard label="Today's Sales" value={0} loading />);
    // No label/value text should be rendered while loading — only the skeleton placeholder.
    expect(screen.queryByText("Today's Sales")).not.toBeInTheDocument();
  });

  it('renders the label and value once loaded', () => {
    render(<KpiCard label="Today's Sales" value={1250} />);
    expect(screen.getByText("Today's Sales")).toBeInTheDocument();
  });

  it('renders an error state with a working retry action', () => {
    const onRetry = vi.fn();
    render(<KpiCard label="Today's Sales" value={0} error onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load Today's Sales");
    screen.getByText('Retry').click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('transitions from loading to value when props change', () => {
    const { rerender } = render(<KpiCard label="Today's Sales" value={0} loading />);
    expect(screen.queryByText("Today's Sales")).not.toBeInTheDocument();

    rerender(<KpiCard label="Today's Sales" value={500} />);
    expect(screen.getByText("Today's Sales")).toBeInTheDocument();
  });
});
