export type ExpensePaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type ExpenseApprovalStatus = 'NOT_REQUIRED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type RecurrenceFrequency = 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
export type ExpensePaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD' | 'OTHER';

export const PAYMENT_METHODS: ExpensePaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'];
export const RECURRENCE_LABELS: Record<RecurrenceFrequency, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUALLY: 'Annually',
};

export interface ExpenseCategory {
  id: string;
  name: string;
  label: string;
  parentId: string | null;
  isActive: boolean;
  expenseCount: number;
  templateCount: number;
}

export interface Expense {
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

export interface ExpensePayment {
  id: string;
  amount: number;
  method: ExpensePaymentMethod;
  referenceNumber: string | null;
  paymentDate: string;
  notes: string | null;
  recordedBy: string;
}

export interface ExpenseDetail extends Expense {
  payments: ExpensePayment[];
}

export interface CreateExpenseInput {
  categoryId: string;
  branchId?: string;
  payeeName: string;
  amount: number;
  incurredDate?: string;
  dueDate?: string;
  receiptUrl?: string;
  notes?: string;
}

export interface RecordPaymentInput {
  amount: number;
  method: ExpensePaymentMethod;
  paymentDate?: string;
  referenceNumber?: string;
  notes?: string;
}

export interface RecurringTemplate {
  id: string;
  branchId: string;
  categoryId: string;
  categoryName: string | null;
  payeeName: string;
  defaultAmount: number | null;
  recurrenceFrequency: RecurrenceFrequency;
  dayOfPeriod: number;
  notes: string | null;
  isActive: boolean;
  startedAt: string;
  endedAt: string | null;
  lastGeneratedPeriod: string | null;
  nextGenerationDate: string | null;
  createdAt: string;
}

export interface CreateTemplateInput {
  categoryId: string;
  branchId?: string;
  payeeName: string;
  defaultAmount?: number;
  recurrenceFrequency: RecurrenceFrequency;
  dayOfPeriod: number;
  notes?: string;
}

export interface ConsolidatedPayableRow {
  source: 'EXPENSE' | 'PURCHASE_ORDER';
  id: string;
  reference: string;
  party: string;
  categoryOrType: string;
  amount: number;
  amountPaid: number;
  outstanding: number;
  dueDate: string | null;
  isOverdue: boolean;
  status: string;
}

export interface PayablesTotals {
  count: number;
  totalOutstanding: number;
  overdueOutstanding: number;
  expenseOutstanding: number;
  purchaseOrderOutstanding: number;
}

export interface ExpenseSummary {
  dateFrom: string;
  dateTo: string;
  total: number;
  count: number;
  byCategory: Array<{ categoryId: string; categoryName: string; label: string; total: number; count: number }>;
}

export interface GenerationResult {
  processed: number;
  generated: number;
  skipped: number;
  failed: number;
}
