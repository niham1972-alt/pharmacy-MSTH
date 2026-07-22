import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { assertReportAccess } from './report-access';
import { ReportFilters, ReportType } from './interfaces/report-filters.interface';

/** Saved report configurations (spec §2.6). Each is scoped to its owner + pharmacy;
 *  saving requires access to the underlying report type. */
@Injectable()
export class SavedConfigurationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(user: AuthenticatedUser) {
    const rows = await this.prisma.savedReportConfiguration.findMany({ where: { pharmacyId: user.pharmacyId, userId: user.userId }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ({ id: r.id, reportType: r.reportType, name: r.name, filters: r.filters, createdAt: r.createdAt.toISOString() }));
  }

  async create(user: AuthenticatedUser, body: { reportType: ReportType; name: string; filters: ReportFilters }) {
    assertReportAccess(user.role, body.reportType);
    if (!body.name?.trim()) throw new ForbiddenException({ errorCode: 'NAME_REQUIRED', message: 'A name is required.' });
    const row = await this.prisma.savedReportConfiguration.create({
      data: { pharmacyId: user.pharmacyId, userId: user.userId, reportType: body.reportType, name: body.name.trim(), filters: (body.filters ?? {}) as unknown as Prisma.InputJsonValue },
    });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'SAVED_REPORT_CONFIGURATION_CREATED', entityType: 'SAVED_REPORT_CONFIGURATION', entityId: row.id, metadata: { reportType: body.reportType, name: row.name } });
    return { id: row.id, reportType: row.reportType, name: row.name, filters: row.filters, createdAt: row.createdAt.toISOString() };
  }

  async remove(user: AuthenticatedUser, id: string) {
    const row = await this.prisma.savedReportConfiguration.findFirst({ where: { id, pharmacyId: user.pharmacyId, userId: user.userId } });
    if (!row) throw new NotFoundException({ errorCode: 'CONFIG_NOT_FOUND', message: 'Saved configuration not found.' });
    await this.prisma.savedReportConfiguration.delete({ where: { id } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'SAVED_REPORT_CONFIGURATION_DELETED', entityType: 'SAVED_REPORT_CONFIGURATION', entityId: id, metadata: { name: row.name } });
    return { id, deleted: true };
  }
}
