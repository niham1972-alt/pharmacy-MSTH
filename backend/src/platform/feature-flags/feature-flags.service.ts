import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformStaff } from '../common/platform-staff.interface';
import { PlatformAuditService } from '../common/platform-audit.service';
import { FeatureFlagDto } from '../dto/platform.dto';

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: PlatformAuditService) {}

  list() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  /** Tenant-facing: resolve which flags are enabled for a specific pharmacy. */
  async resolveForPharmacy(pharmacyId: string): Promise<Record<string, boolean>> {
    const flags = await this.prisma.featureFlag.findMany();
    const out: Record<string, boolean> = {};
    for (const f of flags) out[f.key] = f.isGloballyEnabled || f.enabledForPharmacyIds.includes(pharmacyId);
    return out;
  }

  private async validatePharmacyIds(ids: string[]) {
    if (!ids?.length) return;
    const found = await this.prisma.pharmacy.count({ where: { id: { in: ids } } });
    if (found !== new Set(ids).size) {
      throw new BadRequestException({ errorCode: 'INVALID_PHARMACY_ID', message: 'One or more pharmacy ids in the rollout list do not exist.' });
    }
  }

  async create(staff: PlatformStaff, dto: FeatureFlagDto) {
    await this.validatePharmacyIds(dto.enabledForPharmacyIds ?? []);
    try {
      const created = await this.prisma.featureFlag.create({ data: { key: dto.key, description: dto.description, isGloballyEnabled: dto.isGloballyEnabled ?? false, enabledForPharmacyIds: dto.enabledForPharmacyIds ?? [] } });
      await this.audit.record(staff, 'FEATURE_FLAG_CHANGED', 'FEATURE_FLAG', { entityId: created.id, metadata: { key: dto.key, action: 'created' } });
      return created;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ errorCode: 'FLAG_EXISTS', message: `A feature flag with key "${dto.key}" already exists.` });
      }
      throw err;
    }
  }

  async update(staff: PlatformStaff, id: string, dto: FeatureFlagDto) {
    await this.ensure(id);
    await this.validatePharmacyIds(dto.enabledForPharmacyIds ?? []);
    const updated = await this.prisma.featureFlag.update({ where: { id }, data: { description: dto.description, isGloballyEnabled: dto.isGloballyEnabled, enabledForPharmacyIds: dto.enabledForPharmacyIds } });
    await this.audit.record(staff, 'FEATURE_FLAG_CHANGED', 'FEATURE_FLAG', { entityId: id, metadata: { key: updated.key, action: 'updated' } });
    return updated;
  }

  async remove(staff: PlatformStaff, id: string) {
    const f = await this.ensure(id);
    await this.prisma.featureFlag.delete({ where: { id } });
    await this.audit.record(staff, 'FEATURE_FLAG_CHANGED', 'FEATURE_FLAG', { entityId: id, metadata: { key: f.key, action: 'deleted' } });
    return { id, deleted: true };
  }

  private async ensure(id: string) {
    const f = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (!f) throw new NotFoundException({ errorCode: 'FLAG_NOT_FOUND', message: 'Feature flag not found' });
    return f;
  }
}
