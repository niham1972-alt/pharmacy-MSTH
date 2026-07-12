import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformStaff } from '../common/platform-staff.interface';
import { PlatformAuditService } from '../common/platform-audit.service';
import { AnnouncementDto } from '../dto/platform.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: PlatformAuditService) {}

  list() {
    return this.prisma.platformAnnouncement.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /** Tenant-facing: the currently-live announcements to surface as a banner. */
  async active() {
    const now = new Date();
    const rows = await this.prisma.platformAnnouncement.findMany({
      where: { isActive: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      orderBy: { startsAt: 'desc' },
    });
    return rows.map((a) => ({ id: a.id, title: a.title, message: a.message, severity: a.severity }));
  }

  async create(staff: PlatformStaff, dto: AnnouncementDto) {
    const created = await this.prisma.platformAnnouncement.create({
      data: { title: dto.title, message: dto.message, severity: dto.severity ?? 'INFO', startsAt: dto.startsAt ?? new Date(), endsAt: dto.endsAt, isActive: dto.isActive ?? true, createdBy: staff.id },
    });
    await this.audit.record(staff, 'ANNOUNCEMENT_PUBLISHED', 'ANNOUNCEMENT', { entityId: created.id, metadata: { title: dto.title, severity: created.severity } });
    return created;
  }

  async update(staff: PlatformStaff, id: string, dto: AnnouncementDto) {
    await this.ensure(id);
    const updated = await this.prisma.platformAnnouncement.update({ where: { id }, data: { title: dto.title, message: dto.message, severity: dto.severity, startsAt: dto.startsAt, endsAt: dto.endsAt, isActive: dto.isActive } });
    await this.audit.record(staff, 'ANNOUNCEMENT_PUBLISHED', 'ANNOUNCEMENT', { entityId: id, metadata: { updated: true } });
    return updated;
  }

  async remove(staff: PlatformStaff, id: string) {
    await this.ensure(id);
    await this.prisma.platformAnnouncement.update({ where: { id }, data: { isActive: false, endsAt: new Date() } });
    await this.audit.record(staff, 'ANNOUNCEMENT_PUBLISHED', 'ANNOUNCEMENT', { entityId: id, metadata: { expired: true } });
    return { id, expired: true };
  }

  private async ensure(id: string) {
    const a = await this.prisma.platformAnnouncement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException({ errorCode: 'ANNOUNCEMENT_NOT_FOUND', message: 'Announcement not found' });
  }
}
