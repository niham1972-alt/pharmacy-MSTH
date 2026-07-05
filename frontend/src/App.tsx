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

export default function App() {
  return (
    <Routes>
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
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
