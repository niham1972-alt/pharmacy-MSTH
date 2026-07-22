import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { ReportsService, REPORT_TITLES } from '../reports.service';
import { assertReportAccess } from '../report-access';
import { CsvExporterService } from './csv-exporter.service';
import { PdfExporterService } from './pdf-exporter.service';
import { ExportFormat, ReportFilters, ReportType } from '../interfaces/report-filters.interface';

/**
 * Async export orchestration (spec §3/§7/§12). An export request returns a job id
 * immediately; generation runs in the background and the frontend polls
 * GET /export/:jobId. The artifact is stored self-contained as a data-URL on the
 * job row (consistent with how attachments are stored elsewhere). Sensitive by
 * nature — access mirrors the report's own role rules (spec §17).
 */
@Injectable()
export class ExportJobService {
  private readonly logger = new Logger('ReportExport');

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly csv: CsvExporterService,
    private readonly pdf: PdfExporterService,
    private readonly audit: AuditLogService,
  ) {}

  async request(user: AuthenticatedUser, reportType: ReportType, filters: ReportFilters, format: ExportFormat): Promise<{ jobId: string; status: string }> {
    assertReportAccess(user.role, reportType);
    if (format !== 'CSV' && format !== 'PDF') throw new ForbiddenException({ errorCode: 'INVALID_FORMAT', message: 'format must be CSV or PDF.' });

    const job = await this.prisma.reportExportJob.create({
      data: { pharmacyId: user.pharmacyId, reportType, filters: filters as unknown as Prisma.InputJsonValue, format, status: 'GENERATING', requestedBy: user.userId },
    });
    // Fire-and-forget generation; the client polls for completion.
    void this.generate(user, job.id, reportType, filters, format);
    return { jobId: job.id, status: 'GENERATING' };
  }

  private async generate(user: AuthenticatedUser, jobId: string, reportType: ReportType, filters: ReportFilters, format: ExportFormat): Promise<void> {
    try {
      const report = await this.reports.runTabular(user, reportType, filters);
      const title = REPORT_TITLES[reportType];
      const stamp = new Date().toISOString().slice(0, 10);
      let dataUrl: string;
      let fileName: string;
      if (format === 'CSV') {
        dataUrl = `data:text/csv;base64,${Buffer.from(this.csv.toCsv(report), 'utf8').toString('base64')}`;
        fileName = `${reportType.toLowerCase()}_${stamp}.csv`;
      } else {
        dataUrl = `data:application/pdf;base64,${this.pdf.toPdfBuffer(title, report).toString('base64')}`;
        fileName = `${reportType.toLowerCase()}_${stamp}.pdf`;
      }
      await this.prisma.reportExportJob.update({ where: { id: jobId }, data: { status: 'READY', fileUrl: dataUrl, fileName, completedAt: new Date() } });
      await this.audit.record({
        pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId,
        action: 'REPORT_EXPORTED', entityType: 'REPORT_EXPORT_JOB', entityId: jobId,
        metadata: { reportType, format, filters, rows: report.rows.length },
      });
    } catch (err) {
      this.logger.error(`Export job ${jobId} failed: ${(err as Error).message}`);
      await this.prisma.reportExportJob.update({ where: { id: jobId }, data: { status: 'FAILED', error: (err as Error).message, completedAt: new Date() } }).catch(() => undefined);
    }
  }

  async getJob(user: AuthenticatedUser, jobId: string) {
    const job = await this.prisma.reportExportJob.findFirst({ where: { id: jobId, pharmacyId: user.pharmacyId } });
    if (!job) throw new NotFoundException({ errorCode: 'JOB_NOT_FOUND', message: 'Export job not found.' });
    // Only the requester (or an admin) may fetch a potentially-sensitive artifact.
    if (job.requestedBy !== user.userId && user.role !== 'admin' && user.role !== 'super_admin') {
      throw new ForbiddenException({ errorCode: 'NOT_YOURS', message: 'You cannot access this export job.' });
    }
    // Re-check the report-type access in case the role changed since the request.
    assertReportAccess(user.role, job.reportType as ReportType);
    return {
      id: job.id, reportType: job.reportType, format: job.format, status: job.status,
      fileUrl: job.status === 'READY' ? job.fileUrl : null, fileName: job.fileName,
      error: job.error, createdAt: job.createdAt.toISOString(), completedAt: job.completedAt?.toISOString() ?? null,
    };
  }
}
