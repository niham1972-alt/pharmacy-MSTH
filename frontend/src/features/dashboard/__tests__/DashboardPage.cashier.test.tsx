import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DashboardPage } from '../../../pages/Dashboard/DashboardPage';

vi.mock('../../../shared/auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      userId: 'cashier-1',
      email: 'cashier@example.com',
      role: 'cashier',
      pharmacyId: 'pharmacy-1',
      branchId: 'branch-1',
      accessibleBranchIds: ['branch-1'],
    },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock('../api/dashboard.api', () => ({
  dashboardApi: {
    getSummary: vi.fn().mockResolvedValue({ data: { todaySales: { amount: 100, count: 2, changePct: 0 } } }),
    getSalesTrend: vi.fn().mockResolvedValue({ data: [] }),
    getTopSelling: vi.fn().mockResolvedValue({ data: [] }),
    getAlerts: vi.fn().mockResolvedValue({ data: [] }),
    acknowledgeAlert: vi.fn().mockResolvedValue({ data: null }),
    getActivityFeed: vi.fn().mockResolvedValue({ data: [] }),
    getPurchaseSnapshot: vi.fn().mockResolvedValue({ data: { pendingOrders: [], pendingOrdersCount: 0 } }),
    getCashSummary: vi.fn().mockResolvedValue({ data: { totalsByMethod: { CASH: 100 }, total: 100, scope: 'own' } }),
    getPreferences: vi.fn().mockResolvedValue({ data: [] }),
    savePreferences: vi.fn().mockResolvedValue({ data: null }),
  },
}));

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage — cashier role', () => {
  it('never renders profit or purchase-snapshot widgets in the DOM for a cashier', async () => {
    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('kpi-grid')).toBeInTheDocument());

    // Cashier's KPI set is sales-only — todayProfit must never even reach the DOM.
    expect(screen.queryByText("Today's Profit")).not.toBeInTheDocument();

    // Purchase snapshot, top-selling, and the sales-trend chart are all off-limits for cashier.
    expect(screen.queryByRole('heading', { name: /Supplier & Purchase Snapshot/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Top Selling Medicines/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Sales Trend/i })).not.toBeInTheDocument();

    // Alerts panel is not visible to cashiers either.
    expect(screen.queryByRole('heading', { name: /Low Stock & Expiry Alerts/i })).not.toBeInTheDocument();
  });

  it('still renders the widgets cashiers are allowed to see', async () => {
    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('kpi-grid')).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: /Cash & Payment Summary/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Quick Actions/i })).toBeInTheDocument();
  });
});
