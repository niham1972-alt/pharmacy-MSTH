import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { LoginPage } from './shared/auth/LoginPage';
import { ProtectedRoute } from './shared/auth/ProtectedRoute';
import { useAuth } from './shared/auth/AuthContext';
import { AppShell } from './shared/layout/AppShell';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { MedicinesListPage } from './pages/Medicines/MedicinesListPage';
import { MedicineDetailPage } from './pages/Medicines/MedicineDetailPage';
import { MedicineFormPage } from './pages/Medicines/MedicineFormPage';
import { LookupsManagementPage } from './pages/Medicines/LookupsManagementPage';
import { PurchaseOrdersListPage } from './pages/Purchases/PurchaseOrdersListPage';
import { PurchaseOrderDetailPage } from './pages/Purchases/PurchaseOrderDetailPage';
import { PurchaseOrderFormPage } from './pages/Purchases/PurchaseOrderFormPage';
import { GoodsReceiptFormPage } from './pages/Purchases/GoodsReceiptFormPage';
import { PendingApprovalsPage } from './pages/Purchases/PendingApprovalsPage';
import { PosScreenPage } from './pages/POS/PosScreenPage';
import { SessionClosePage } from './pages/POS/SessionClosePage';
import { SalesHistoryListPage } from './pages/Sales/SalesHistoryListPage';
import { SaleDetailPage } from './pages/Sales/SaleDetailPage';
import { InventoryListPage } from './pages/Inventory/InventoryListPage';
import { InventoryDetailPage } from './pages/Inventory/InventoryDetailPage';
import { ReorderSuggestionsPage } from './pages/Inventory/ReorderSuggestionsPage';
import { ReconciliationPage } from './pages/Inventory/ReconciliationPage';
import { BatchesListPage } from './pages/Batches/BatchesListPage';
import { BatchDetailPage } from './pages/Batches/BatchDetailPage';
import { ExpiringStockPage } from './pages/Batches/ExpiringStockPage';
import { ExpiredStockReviewPage } from './pages/Batches/ExpiredStockReviewPage';
import { RecallsPage } from './pages/Batches/RecallsPage';
import { SuppliersListPage } from './pages/Suppliers/SuppliersListPage';
import { SupplierDetailPage } from './pages/Suppliers/SupplierDetailPage';
import { SupplierFormPage } from './pages/Suppliers/SupplierFormPage';
import { SuppliersNeedingAttentionPage } from './pages/Suppliers/SuppliersNeedingAttentionPage';
import { CustomersListPage } from './pages/Customers/CustomersListPage';
import { CustomerDetailPage } from './pages/Customers/CustomerDetailPage';
import { CustomerFormPage } from './pages/Customers/CustomerFormPage';
import { MergeDuplicatesPage } from './pages/Customers/MergeDuplicatesPage';
import { UsersListPage } from './pages/Users/UsersListPage';
import { UserDetailPage } from './pages/Users/UserDetailPage';
import { PermissionMatrixPage } from './pages/Users/PermissionMatrixPage';
import { MyProfilePage } from './pages/Users/MyProfilePage';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { ProcessReturnPage } from './pages/SalesReturns/ProcessReturnPage';
import { SalesReturnsListPage } from './pages/SalesReturns/SalesReturnsListPage';
import { SalesReturnDetailPage } from './pages/SalesReturns/SalesReturnDetailPage';
import { ReturnRateReportsPage } from './pages/SalesReturns/ReturnRateReportsPage';
import { InitiateReturnPage } from './pages/PurchaseReturns/InitiateReturnPage';
import { PurchaseReturnsListPage } from './pages/PurchaseReturns/PurchaseReturnsListPage';
import { PurchaseReturnDetailPage } from './pages/PurchaseReturns/PurchaseReturnDetailPage';
import { PendingSettlementsPage } from './pages/PurchaseReturns/PendingSettlementsPage';
import { AuditLogsListPage } from './pages/AuditLogs/AuditLogsListPage';
import { SensitiveEventsPage } from './pages/AuditLogs/SensitiveEventsPage';
import { UserActivityPage } from './pages/AuditLogs/UserActivityPage';
import { PlatformApp } from './platform-app/PlatformApp';
import { StockAdjustmentsListPage } from './pages/StockAdjustments/StockAdjustmentsListPage';
import { CreateAdjustmentPage } from './pages/StockAdjustments/CreateAdjustmentPage';
import { BulkAdjustmentPage } from './pages/StockAdjustments/BulkAdjustmentPage';
import { StockAdjustmentDetailPage } from './pages/StockAdjustments/StockAdjustmentDetailPage';
import { PendingApprovalsPage as AdjustmentApprovalsPage } from './pages/StockAdjustments/PendingApprovalsPage';
import { ShrinkageReportPage } from './pages/StockAdjustments/ShrinkageReportPage';
import { ExpensesListPage } from './pages/Expenses/ExpensesListPage';
import { ExpenseDetailPage } from './pages/Expenses/ExpenseDetailPage';
import { RecurringTemplatesPage } from './pages/Expenses/RecurringTemplatesPage';
import { ConsolidatedPayablesPage } from './pages/Expenses/ConsolidatedPayablesPage';
import { ExpenseSummaryReportPage } from './pages/Expenses/ExpenseSummaryReportPage';
import { ReportsHomePage } from './pages/Reports/ReportsHomePage';
import { GenericReportPage } from './pages/Reports/GenericReportPage';
import { SavedReportsPage } from './pages/Reports/SavedReportsPage';
import { ComplianceReportsPage } from './pages/Reports/ComplianceReportsPage';
import { ProfitLossReportPage, SalesRegisterPage, StockValuationReportPage, ExpiringStockReportPage, TopSellingReportPage, SupplierPerformanceReportPage } from './pages/Reports/namedReports';

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  );
}

/** Purchases are invisible to cashier at the route level (spec §17). */
function PurchasesGate() {
  const { user } = useAuth();
  if (user?.role === 'cashier') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** POS selling is limited to cashier/pharmacist/admin; others go to history. */
function PosGate() {
  const { user } = useAuth();
  if (!['super_admin', 'admin', 'pharmacist', 'cashier'].includes(user?.role ?? '')) return <Navigate to="/sales" replace />;
  return <Outlet />;
}

/** Sales history: everyone except inventory_manager. */
function SalesGate() {
  const { user } = useAuth();
  if (user?.role === 'inventory_manager') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Inventory: all roles may view (cashier gets a redacted, qty-only view). */
function InventoryGate() {
  return <Outlet />;
}

/** Batches: cashier has no direct access (spec §13); accountant only via reports. */
function BatchesGate() {
  const { user } = useAuth();
  if (['cashier', 'accountant'].includes(user?.role ?? '')) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Suppliers: cashier has zero access (spec §13). */
function SuppliersGate() {
  const { user } = useAuth();
  if (user?.role === 'cashier') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Customers: cashier reaches customers only via the POS selector; the dedicated
 * UI + inventory_manager are excluded (spec §13, elevated privacy posture). */
function CustomersGate() {
  const { user } = useAuth();
  if (['cashier', 'inventory_manager'].includes(user?.role ?? '')) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Users & Roles: admin/super_admin only (spec §13). */
function UsersGate() {
  const { user } = useAuth();
  if (!['super_admin', 'admin'].includes(user?.role ?? '')) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Purchase Returns: admin/inventory_manager/accountant/auditor (spec §13, cashier & pharmacist excluded). */
function PurchaseReturnsGate() {
  const { user } = useAuth();
  if (!['super_admin', 'admin', 'inventory_manager', 'accountant', 'auditor'].includes(user?.role ?? '')) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Initiating a purchase return: admin/inventory_manager only. */
function InitiatePurchaseReturnGate() {
  const { user } = useAuth();
  if (!['super_admin', 'admin', 'inventory_manager'].includes(user?.role ?? '')) return <Navigate to="/purchase-returns" replace />;
  return <Outlet />;
}

/** Sales Returns: everyone except inventory_manager (spec §13). */
function SalesReturnsGate() {
  const { user } = useAuth();
  if (user?.role === 'inventory_manager') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Processing a return: admin/pharmacist/cashier only (accountant/auditor are read-only). */
function ProcessReturnGate() {
  const { user } = useAuth();
  if (!['super_admin', 'admin', 'pharmacist', 'cashier'].includes(user?.role ?? '')) return <Navigate to="/sales-returns" replace />;
  return <Outlet />;
}

/** Settings: admin (full), auditor (read-only), inventory_manager (Purchases only). */
function SettingsGate() {
  const { user } = useAuth();
  if (!['super_admin', 'admin', 'auditor', 'inventory_manager'].includes(user?.role ?? '')) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Stock Adjustments: admin/inventory_manager/accountant/auditor may view (spec §13). */
function AdjustmentsGate() {
  const { user } = useAuth();
  if (!['super_admin', 'admin', 'inventory_manager', 'accountant', 'auditor'].includes(user?.role ?? '')) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Creating/bulk adjustments: admin/inventory_manager only. */
function AdjustmentCreateGate() {
  const { user } = useAuth();
  if (!['super_admin', 'admin', 'inventory_manager'].includes(user?.role ?? '')) return <Navigate to="/stock-adjustments" replace />;
  return <Outlet />;
}

/** Approving adjustments: admin only. */
function AdjustmentApproveGate() {
  const { user } = useAuth();
  if (!['super_admin', 'admin'].includes(user?.role ?? '')) return <Navigate to="/stock-adjustments" replace />;
  return <Outlet />;
}

/** Expenses: admin/accountant/auditor only — financial/administrative domain (spec §13). */
function ExpensesGate() {
  const { user } = useAuth();
  if (!['super_admin', 'admin', 'accountant', 'auditor'].includes(user?.role ?? '')) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Reports: every role except cashier has access to at least one report (spec §13);
 *  per-report access is enforced within each report (mirrors its source module). */
function ReportsGate() {
  const { user } = useAuth();
  if (user?.role === 'cashier') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Audit Log: admin/auditor only for the global log (spec §13). */
function AuditGate() {
  const { user } = useAuth();
  if (!['super_admin', 'admin', 'auditor'].includes(user?.role ?? '')) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      {/* Platform-app: entirely separate route tree + auth from the tenant app. */}
      <Route path="/platform-admin/*" element={<PlatformApp />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/medicines" element={<MedicinesListPage />} />
        <Route path="/medicines/new" element={<MedicineFormPage />} />
        <Route path="/medicines/lookups" element={<LookupsManagementPage />} />
        <Route path="/medicines/:id" element={<MedicineDetailPage />} />
        <Route path="/medicines/:id/edit" element={<MedicineFormPage />} />
        <Route element={<PurchasesGate />}>
          <Route path="/purchases" element={<PurchaseOrdersListPage />} />
          <Route path="/purchases/new" element={<PurchaseOrderFormPage />} />
          <Route path="/purchases/receive" element={<GoodsReceiptFormPage />} />
          <Route path="/purchases/approvals" element={<PendingApprovalsPage />} />
          <Route path="/purchases/:id" element={<PurchaseOrderDetailPage />} />
        </Route>
        <Route element={<PosGate />}>
          <Route path="/pos" element={<PosScreenPage />} />
          <Route path="/pos/close" element={<SessionClosePage />} />
        </Route>
        <Route element={<SalesGate />}>
          <Route path="/sales" element={<SalesHistoryListPage />} />
          <Route path="/sales/:id" element={<SaleDetailPage />} />
        </Route>
        <Route element={<InventoryGate />}>
          <Route path="/inventory" element={<InventoryListPage />} />
          <Route path="/inventory/reorder" element={<ReorderSuggestionsPage />} />
          <Route path="/inventory/reconciliation" element={<ReconciliationPage />} />
          <Route path="/inventory/:medicineId" element={<InventoryDetailPage />} />
        </Route>
        <Route element={<BatchesGate />}>
          <Route path="/batches" element={<BatchesListPage />} />
          <Route path="/batches/expiring" element={<ExpiringStockPage />} />
          <Route path="/batches/expired" element={<ExpiredStockReviewPage />} />
          <Route path="/batches/recalls" element={<RecallsPage />} />
          <Route path="/batches/:id" element={<BatchDetailPage />} />
        </Route>
        <Route element={<SuppliersGate />}>
          <Route path="/suppliers" element={<SuppliersListPage />} />
          <Route path="/suppliers/new" element={<SupplierFormPage />} />
          <Route path="/suppliers/attention" element={<SuppliersNeedingAttentionPage />} />
          <Route path="/suppliers/:id" element={<SupplierDetailPage />} />
          <Route path="/suppliers/:id/edit" element={<SupplierFormPage />} />
        </Route>
        <Route element={<CustomersGate />}>
          <Route path="/customers" element={<CustomersListPage />} />
          <Route path="/customers/new" element={<CustomerFormPage />} />
          <Route path="/customers/merge" element={<MergeDuplicatesPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
        </Route>
        <Route element={<PurchaseReturnsGate />}>
          <Route element={<InitiatePurchaseReturnGate />}>
            <Route path="/purchase-returns/new" element={<InitiateReturnPage />} />
          </Route>
          <Route path="/purchase-returns" element={<PurchaseReturnsListPage />} />
          <Route path="/purchase-returns/pending" element={<PendingSettlementsPage />} />
          <Route path="/purchase-returns/:id" element={<PurchaseReturnDetailPage />} />
        </Route>
        <Route element={<SalesReturnsGate />}>
          <Route element={<ProcessReturnGate />}>
            <Route path="/sales-returns/new" element={<ProcessReturnPage />} />
          </Route>
          <Route path="/sales-returns" element={<SalesReturnsListPage />} />
          <Route path="/sales-returns/reports" element={<ReturnRateReportsPage />} />
          <Route path="/sales-returns/:id" element={<SalesReturnDetailPage />} />
        </Route>
        <Route path="/my-profile" element={<MyProfilePage />} />
        <Route element={<SettingsGate />}>
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route element={<UsersGate />}>
          <Route path="/users" element={<UsersListPage />} />
          <Route path="/users/permission-matrix" element={<PermissionMatrixPage />} />
          <Route path="/users/:id" element={<UserDetailPage />} />
        </Route>
        <Route element={<AdjustmentsGate />}>
          <Route element={<AdjustmentCreateGate />}>
            <Route path="/stock-adjustments/new" element={<CreateAdjustmentPage />} />
            <Route path="/stock-adjustments/bulk" element={<BulkAdjustmentPage />} />
          </Route>
          <Route element={<AdjustmentApproveGate />}>
            <Route path="/stock-adjustments/pending" element={<AdjustmentApprovalsPage />} />
          </Route>
          <Route path="/stock-adjustments" element={<StockAdjustmentsListPage />} />
          <Route path="/stock-adjustments/shrinkage" element={<ShrinkageReportPage />} />
          <Route path="/stock-adjustments/:id" element={<StockAdjustmentDetailPage />} />
        </Route>
        <Route element={<ExpensesGate />}>
          <Route path="/expenses/templates" element={<RecurringTemplatesPage />} />
          <Route path="/expenses/payables" element={<ConsolidatedPayablesPage />} />
          <Route path="/expenses/summary" element={<ExpenseSummaryReportPage />} />
          <Route path="/expenses" element={<ExpensesListPage />} />
          <Route path="/expenses/:id" element={<ExpenseDetailPage />} />
        </Route>
        <Route element={<ReportsGate />}>
          <Route path="/reports" element={<ReportsHomePage />} />
          <Route path="/reports/saved" element={<SavedReportsPage />} />
          <Route path="/reports/compliance" element={<ComplianceReportsPage />} />
          <Route path="/reports/profit-loss" element={<ProfitLossReportPage />} />
          <Route path="/reports/sales-register" element={<SalesRegisterPage />} />
          <Route path="/reports/stock-valuation" element={<StockValuationReportPage />} />
          <Route path="/reports/expiring-stock" element={<ExpiringStockReportPage />} />
          <Route path="/reports/top-selling" element={<TopSellingReportPage />} />
          <Route path="/reports/supplier-performance" element={<SupplierPerformanceReportPage />} />
          <Route path="/reports/:reportKey" element={<GenericReportPage />} />
        </Route>
        <Route element={<AuditGate />}>
          <Route path="/audit-logs" element={<AuditLogsListPage />} />
          <Route path="/audit-logs/sensitive" element={<SensitiveEventsPage />} />
          <Route path="/audit-logs/user/:userId" element={<UserActivityPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
