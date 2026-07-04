import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PurchaseEventsEmitter } from './events/purchase-events.emitter';
import { RecordPaymentDto } from './dto/purchase-order.dto';
import { dec } from './purchase-orders.service';

@Injectable()
export class PurchasePaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: PurchaseEventsEmitter,
  ) {}

  async record(user: AuthenticatedUser, purchaseOrderId: string, dto: RecordPaymentDto) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id: purchaseOrderId, pharmacyId: user.pharmacyId } });
    if (!po) throw new NotFoundException({ errorCode: 'PO_NOT_FOUND', message: 'Purchase order not found' });

    const outstanding = dec(po.grandTotal) - dec(po.amountPaid);
    if (dto.amount > outstanding + 0.001) {
      throw new BadRequestException({ errorCode: 'OVERPAYMENT', message: `Payment exceeds the outstanding balance of ${outstanding.toFixed(2)}.` });
    }

    const newPaid = Math.round((dec(po.amountPaid) + dto.amount) * 100) / 100;
    const paymentStatus = newPaid >= dec(po.grandTotal) - 0.001 ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

    const payment = await this.prisma.$transaction(async (tx) => {
      const p = await tx.purchasePayment.create({
        data: {
          pharmacyId: user.pharmacyId,
          purchaseOrderId,
          amount: dto.amount,
          method: dto.method,
          referenceNumber: dto.referenceNumber,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          recordedBy: user.userId,
          notes: dto.notes,
        },
      });
      await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { amountPaid: newPaid, paymentStatus } });
      return p;
    });

    await this.audit.record({
      pharmacyId: user.pharmacyId,
      branchId: po.branchId,
      userId: user.userId,
      action: 'PAYMENT_RECORDED',
      entityType: 'PURCHASE_ORDER',
      entityId: purchaseOrderId,
      metadata: { amount: dto.amount, method: dto.method, paymentStatus },
    });
    this.events.paymentRecorded({ pharmacyId: user.pharmacyId, purchaseOrderId, amount: dto.amount, actorId: user.userId });

    return { id: payment.id, amountPaid: newPaid, paymentStatus, outstanding: Math.round((dec(po.grandTotal) - newPaid) * 100) / 100 };
  }

  async list(user: AuthenticatedUser, purchaseOrderId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id: purchaseOrderId, pharmacyId: user.pharmacyId }, select: { id: true } });
    if (!po) throw new NotFoundException({ errorCode: 'PO_NOT_FOUND', message: 'Purchase order not found' });
    const payments = await this.prisma.purchasePayment.findMany({ where: { purchaseOrderId }, orderBy: { paymentDate: 'desc' } });
    return payments.map((p) => ({
      id: p.id,
      amount: dec(p.amount),
      method: p.method,
      referenceNumber: p.referenceNumber,
      paymentDate: p.paymentDate.toISOString(),
      notes: p.notes,
    }));
  }

  /** Suppliers stub (Module 7) — minimal list/create so PO forms have suppliers. */
  suppliers(user: AuthenticatedUser) {
    return this.prisma.supplier.findMany({ where: { pharmacyId: user.pharmacyId, isActive: true }, orderBy: { name: 'asc' } });
  }

  async createSupplier(user: AuthenticatedUser, data: { name: string; contactPerson?: string; phone?: string; email?: string; paymentTermsDays?: number }) {
    if (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'inventory_manager') {
      throw new ForbiddenException({ errorCode: 'FORBIDDEN', message: 'Not permitted to create suppliers.' });
    }
    return this.prisma.supplier.create({
      data: { pharmacyId: user.pharmacyId, name: data.name, contactPerson: data.contactPerson, phone: data.phone, email: data.email, paymentTermsDays: data.paymentTermsDays ?? 30 },
    });
  }
}
