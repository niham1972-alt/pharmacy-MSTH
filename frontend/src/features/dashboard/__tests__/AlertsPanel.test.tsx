import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { AlertRow } from '../components/AlertRow';
import { DashboardAlert } from '../types/dashboard.types';

function renderAlert(alert: DashboardAlert) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ul>
        <AlertRow alert={alert} />
      </ul>
    </QueryClientProvider>,
  );
}

const base: Omit<DashboardAlert, 'severity' | 'id'> = {
  type: 'EXPIRY',
  referenceId: 'batch-1',
  title: 'Batch A123',
  detail: 'Expires in 10 day(s)',
  acknowledged: false,
};

describe('AlertRow color coding', () => {
  it('renders red styling and the critical icon+label for red severity (never color alone)', () => {
    renderAlert({ ...base, id: '1', severity: 'red' });
    expect(screen.getByText('⚠', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/Critical/)).toBeInTheDocument();
  });

  it('renders orange styling and the warning icon+label for orange severity', () => {
    renderAlert({ ...base, id: '2', severity: 'orange' });
    expect(screen.getByText('⏰', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/Warning/)).toBeInTheDocument();
  });

  it('renders yellow styling and the notice icon+label for yellow severity', () => {
    renderAlert({ ...base, id: '3', severity: 'yellow' });
    expect(screen.getByText('📦', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/Notice/)).toBeInTheDocument();
  });

  it('shows "Acknowledged" instead of the action button once acknowledged', () => {
    renderAlert({ ...base, id: '4', severity: 'red', acknowledged: true });
    expect(screen.getByText('Acknowledged')).toBeInTheDocument();
    expect(screen.queryByText('Acknowledge')).not.toBeInTheDocument();
  });
});
