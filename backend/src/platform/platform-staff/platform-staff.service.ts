import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformStaff } from '../common/platform-staff.interface';
import { PlatformAuditService } from '../common/platform-audit.service';
import { PlatformStaffDto, UpdatePlatformStaffDto } from '../dto/platform.dto';

@Injectable()
export class PlatformStaffService {
  constructor(private readonly prisma: PrismaService, private readonly audit: PlatformAuditService) {}

  private serialize(s: Prisma.PlatformStaffUserGetPayload<object>) {
    return { id: s.id, authUserId: s.authUserId, name: s.name, email: s.email, role: s.role, status: s.status, createdAt: s.createdAt.toISOString() };
  }

  async list() {
    const rows = await this.prisma.platformStaffUser.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((s) => this.serialize(s));
  }

  async create(staff: PlatformStaff, dto: PlatformStaffDto) {
    try {
      const created = await this.prisma.platformStaffUser.create({ data: { authUserId: dto.authUserId, name: dto.name, email: dto.email, role: dto.role, createdBy: staff.id } });
      await this.audit.record(staff, 'PLATFORM_STAFF_ACCOUNT_CHANGED', 'PLATFORM_STAFF', { entityId: created.id, metadata: { action: 'created', email: dto.email, role: dto.role } });
      return this.serialize(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ errorCode: 'STAFF_EXISTS', message: 'A platform staff account with this email or auth id already exists.' });
      }
      throw err;
    }
  }

  async update(staff: PlatformStaff, id: string, dto: UpdatePlatformStaffDto) {
    const existing = await this.prisma.platformStaffUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ errorCode: 'STAFF_NOT_FOUND', message: 'Platform staff not found' });
    const updated = await this.prisma.platformStaffUser.update({ where: { id }, data: { name: dto.name, role: dto.role, status: dto.status } });
    await this.audit.record(staff, 'PLATFORM_STAFF_ACCOUNT_CHANGED', 'PLATFORM_STAFF', { entityId: id, metadata: { action: 'updated', changes: Object.keys(dto) } });
    return this.serialize(updated);
  }
}
