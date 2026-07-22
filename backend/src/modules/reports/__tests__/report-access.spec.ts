import { ForbiddenException } from '@nestjs/common';
import { assertReportAccess, canAccessReport, REPORT_ACCESS } from '../report-access';
import { ReportType } from '../interfaces/report-filters.interface';

describe('report access mirrors source-module role rules (spec §11/§13)', () => {
  it('rejects a pharmacist from the Tax Summary (accountant-centric, per Module 13)', () => {
    expect(canAccessReport('pharmacist', 'TAX_SUMMARY')).toBe(false);
    expect(() => assertReportAccess('pharmacist', 'TAX_SUMMARY')).toThrow(ForbiddenException);
  });

  it('rejects a pharmacist from the P&L (financial, admin/accountant only)', () => {
    expect(canAccessReport('pharmacist', 'PROFIT_LOSS')).toBe(false);
  });

  it('allows an accountant the financial reports but not the controlled-substance log', () => {
    expect(canAccessReport('accountant', 'PROFIT_LOSS')).toBe(true);
    expect(canAccessReport('accountant', 'TAX_SUMMARY')).toBe(true);
    expect(canAccessReport('accountant', 'CONTROLLED_SUBSTANCE_LOG')).toBe(false);
  });

  it('allows a pharmacist clinical/sales reports (sales register, controlled-substance log)', () => {
    expect(canAccessReport('pharmacist', 'SALES_REGISTER')).toBe(true);
    expect(canAccessReport('pharmacist', 'CONTROLLED_SUBSTANCE_LOG')).toBe(true);
    expect(canAccessReport('pharmacist', 'CUSTOMER_HISTORY')).toBe(true);
  });

  it('restricts the audit summary to admin/auditor only', () => {
    expect(canAccessReport('auditor', 'AUDIT_SUMMARY')).toBe(true);
    expect(canAccessReport('admin', 'AUDIT_SUMMARY')).toBe(true);
    expect(canAccessReport('accountant', 'AUDIT_SUMMARY')).toBe(false);
    expect(canAccessReport('inventory_manager', 'AUDIT_SUMMARY')).toBe(false);
  });

  it('gives super_admin access to every report type', () => {
    for (const rt of Object.keys(REPORT_ACCESS) as ReportType[]) {
      expect(canAccessReport('super_admin', rt)).toBe(true);
    }
  });

  it('cashier — no reporting access at all (no report lists cashier)', () => {
    for (const rt of Object.keys(REPORT_ACCESS) as ReportType[]) {
      expect(canAccessReport('cashier', rt)).toBe(false);
    }
  });
});
