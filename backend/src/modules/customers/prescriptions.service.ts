import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UploadPrescriptionDto } from './dto/customers.dto';

/** Durable, browsable prescription library — complements Module 4's at-sale
 * SaleComplianceRecord snapshot. Gated to admin/pharmacist at the controller. */
@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  private async ensureCustomer(user: AuthenticatedUser, customerId: string) {
    const c = await this.prisma.customer.findFirst({ where: { id: customerId, pharmacyId: user.pharmacyId }, select: { id: true } });
    if (!c) throw new NotFoundException({ errorCode: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
  }

  async list(user: AuthenticatedUser, customerId: string) {
    await this.ensureCustomer(user, customerId);
    const rows = await this.prisma.prescriptionRecord.findMany({ where: { pharmacyId: user.pharmacyId, customerId }, orderBy: { uploadedAt: 'desc' } });
    return rows.map((p) => ({ id: p.id, fileUrl: p.fileUrl, referenceNumber: p.referenceNumber, prescribingDoctor: p.prescribingDoctor, issuedDate: p.issuedDate?.toISOString() ?? null, linkedSaleIds: p.linkedSaleIds, uploadedBy: p.uploadedBy, uploadedAt: p.uploadedAt.toISOString(), notes: p.notes }));
  }

  async upload(user: AuthenticatedUser, customerId: string, dto: UploadPrescriptionDto) {
    await this.ensureCustomer(user, customerId);
    const p = await this.prisma.prescriptionRecord.create({
      data: { pharmacyId: user.pharmacyId, customerId, fileUrl: dto.fileUrl, referenceNumber: dto.referenceNumber, prescribingDoctor: dto.prescribingDoctor, issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : null, linkedSaleIds: dto.linkedSaleIds ?? [], uploadedBy: user.userId, notes: dto.notes },
    });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'PRESCRIPTION_UPLOADED', entityType: 'CUSTOMER', entityId: customerId, metadata: { prescriptionId: p.id, referenceNumber: p.referenceNumber } });
    return { id: p.id };
  }
}
