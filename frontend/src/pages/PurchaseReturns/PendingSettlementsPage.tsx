import { PurchaseReturnsListPage } from './PurchaseReturnsListPage';

/** Pending-settlement follow-up view (admin/accountant) — reuses the list in
 *  pending mode (shows only non-settled returns + aging). */
export function PendingSettlementsPage() {
  return <PurchaseReturnsListPage pending />;
}
