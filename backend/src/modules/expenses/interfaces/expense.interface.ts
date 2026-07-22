import { ExpenseApprovalStatus, ExpensePaymentStatus } from '@prisma/client';

/** Serialized expense shape returned by the API (money as numbers, dates ISO). */
export interface ExpenseView {
  id: string;
  expenseNumber: string;
  categoryId: string;
  categoryName: string;
  branchId: string;
  payeeName: string;
  amount: number;
  amountPaid: number;
  outstanding: number;
  incurredDate: string;
  dueDate: string | null;
  paymentStatus: ExpensePaymentStatus;
  /** Computed: UNPAID/PARTIALLY_PAID past its due date. */
  isOverdue: boolean;
  approvalStatus: ExpenseApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  isRecurringGenerated: boolean;
  generatedFromTemplateId: string | null;
  receiptUrl: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ConsolidatedPayableRow {
  source: 'EXPENSE' | 'PURCHASE_ORDER';
  id: string;
  reference: string; // expenseNumber / poNumber
  party: string; // payee / supplier
  categoryOrType: string;
  amount: number;
  amountPaid: number;
  outstanding: number;
  dueDate: string | null;
  isOverdue: boolean;
  status: string;
}
