import { ForbiddenException } from '@nestjs/common';
import { PharmacyRole } from '../../common/interfaces/jwt-payload.interface';
import { ReportType } from './interfaces/report-filters.interface';

/**
 * Per-report role access — MIRRORS each source module's own established rules
 * (spec §7 / §11 / §13). This module is a presentation layer, never a
 * permission-bypass, so access to a report equals access to its underlying data
 * in its home module. `super_admin` implicitly has access to everything.
 */
export const REPORT_ACCESS: Record<ReportType, PharmacyRole[]> = {
  PROFIT_LOSS: ['admin', 'accountant'],
  SALES_REGISTER: ['admin', 'pharmacist', 'accountant', 'auditor'],
  PURCHASE_SUMMARY: ['admin', 'inventory_manager', 'accountant', 'auditor'],
  ACCOUNTS_PAYABLE: ['admin', 'accountant', 'auditor'],
  TAX_SUMMARY: ['admin', 'accountant'],
  STOCK_VALUATION: ['admin', 'inventory_manager', 'accountant', 'auditor'],
  STOCK_MOVEMENT: ['admin', 'inventory_manager', 'accountant', 'auditor'],
  EXPIRING_STOCK: ['admin', 'pharmacist', 'inventory_manager', 'auditor'],
  BATCH_TRACEABILITY: ['admin', 'pharmacist', 'inventory_manager', 'auditor'],
  TOP_SELLING: ['admin', 'pharmacist', 'inventory_manager', 'auditor'],
  SALES_RETURNS: ['admin', 'pharmacist', 'auditor'],
  CUSTOMER_HISTORY: ['admin', 'pharmacist'],
  CONTROLLED_SUBSTANCE_LOG: ['admin', 'pharmacist', 'auditor'],
  SUPPLIER_PERFORMANCE: ['admin', 'inventory_manager', 'accountant', 'auditor'],
  PURCHASE_RETURNS: ['admin', 'inventory_manager', 'accountant', 'auditor'],
  SHRINKAGE: ['admin', 'inventory_manager', 'auditor'],
  AUDIT_SUMMARY: ['admin', 'auditor'],
};

export function canAccessReport(role: PharmacyRole, reportType: ReportType): boolean {
  if (role === 'super_admin') return true;
  return (REPORT_ACCESS[reportType] ?? []).includes(role);
}

/** Throw the standard Forbidden envelope if the role can't see this report. */
export function assertReportAccess(role: PharmacyRole, reportType: ReportType): void {
  if (!canAccessReport(role, reportType)) {
    throw new ForbiddenException({ errorCode: 'REPORT_ACCESS_DENIED', message: `Your role (${role}) cannot access the ${reportType} report.` });
  }
}
