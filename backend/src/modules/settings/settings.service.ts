import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma, SettingScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { CORE_SETTINGS, SettingDefinitionInput } from './registry/core-settings.registry';

interface DefMeta {
  def: SettingDefinitionInput;
}

/**
 * Module 18 — THE central, cached configuration store. Every module reads business
 * rules through `get()` instead of hardcoding constants. Resolution chain:
 *   branch override (SettingValue branchId=X) → pharmacy-wide (branchId=null) →
 *   SettingDefinition.defaultValue (from the in-code registry).
 * Aggressively cached in-process with precise invalidation on `set()`/`reset()`.
 * If the DB is momentarily unreachable, `get()` falls back to the registry default
 * (a safe, documented behaviour) rather than throwing into a caller's hot path.
 */
@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger('SettingsService');
  private readonly defs = new Map<string, DefMeta>(); // key -> definition (from registry)
  private readonly cache = new Map<string, { value: unknown; ts: number }>();
  private readonly CACHE_TTL = 5 * 60_000; // safety TTL; invalidation is the primary mechanism

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {
    for (const d of CORE_SETTINGS) this.defs.set(d.key, { def: d });
  }

  /** Idempotently ensure every registered definition exists in the DB at boot. */
  async onModuleInit(): Promise<void> {
  // Don't block app startup on this — run in background so the server
  // starts listening immediately and passes Railway's healthcheck.
  this.syncCoreSettings().catch((err) => {
    this.logger.error(`Could not sync setting definitions: ${(err as Error).message}`);
  });
}

private async syncCoreSettings(): Promise<void> {
  try {
    await Promise.all(
      CORE_SETTINGS.map((d) =>
        this.prisma.settingDefinition.upsert({
          where: { key: d.key },
          update: { label: d.label, description: d.description, category: d.category, valueType: d.valueType, defaultValue: d.defaultValue as Prisma.InputJsonValue, validationRule: (d.validationRule ?? Prisma.JsonNull) as Prisma.InputJsonValue, scope: d.scope ?? 'PHARMACY', isSensitive: d.isSensitive ?? false },
          create: { key: d.key, label: d.label, description: d.description, category: d.category, valueType: d.valueType, defaultValue: d.defaultValue as Prisma.InputJsonValue, validationRule: (d.validationRule ?? Prisma.JsonNull) as Prisma.InputJsonValue, scope: d.scope ?? 'PHARMACY', isSensitive: d.isSensitive ?? false },
        })
      )
    );
    this.logger.log(`Registered ${CORE_SETTINGS.length} setting definitions.`);
  } catch (err) {
    this.logger.error(`Could not sync setting definitions (will use in-memory registry): ${(err as Error).message}`);
  }
}

  private cacheKey(pharmacyId: string, branchId: string | undefined, key: string): string {
    return `${pharmacyId}:${branchId ?? '_'}:${key}`;
  }

  // =========================================================================
  // Read contract
  // =========================================================================
  async get<T = unknown>(key: string, params: { pharmacyId: string; branchId?: string }): Promise<T> {
    const meta = this.defs.get(key);
    if (!meta) {
      // A consuming module referenced an unregistered key — a config bug. Don't
      // crash the request; log and return a safe null (dev tests will notice).
      this.logger.error(`Unregistered setting key requested: "${key}"`);
      return null as T;
    }
    const ck = this.cacheKey(params.pharmacyId, params.branchId, key);
    const hit = this.cache.get(ck);
    if (hit && Date.now() - hit.ts < this.CACHE_TTL) return hit.value as T;

    let value: unknown = meta.def.defaultValue;
    try {
      // NB: `branchId: { in: [null] }` compiles to `IN (NULL)` and matches nothing —
      // an explicit OR with `branchId: null` is required to hit the pharmacy-wide row.
      const scopeOr: Prisma.SettingValueWhereInput[] = [{ branchId: null }];
      if (params.branchId) scopeOr.unshift({ branchId: params.branchId });
      const rows = await this.prisma.settingValue.findMany({ where: { pharmacyId: params.pharmacyId, settingKey: key, OR: scopeOr } });
      const branchRow = params.branchId ? rows.find((r) => r.branchId === params.branchId) : undefined;
      const pharmacyRow = rows.find((r) => r.branchId === null);
      if (branchRow) value = branchRow.value;
      else if (pharmacyRow) value = pharmacyRow.value;
    } catch (err) {
      this.logger.warn(`Setting "${key}" DB read failed, using default: ${(err as Error).message}`);
    }
    this.cache.set(ck, { value, ts: Date.now() });
    return value as T;
  }

  async getMany(keys: string[], params: { pharmacyId: string; branchId?: string }): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    // Single query for all keys, then resolve precedence per key in memory.
    let rows: Array<{ settingKey: string; branchId: string | null; value: unknown }> = [];
    try {
      const scopeOr: Prisma.SettingValueWhereInput[] = [{ branchId: null }];
      if (params.branchId) scopeOr.unshift({ branchId: params.branchId });
      rows = await this.prisma.settingValue.findMany({ where: { pharmacyId: params.pharmacyId, settingKey: { in: keys }, OR: scopeOr } });
    } catch (err) {
      this.logger.warn(`getMany DB read failed, using defaults: ${(err as Error).message}`);
    }
    for (const key of keys) {
      const meta = this.defs.get(key);
      const forKey = rows.filter((r) => r.settingKey === key);
      const branchRow = params.branchId ? forKey.find((r) => r.branchId === params.branchId) : undefined;
      const pharmacyRow = forKey.find((r) => r.branchId === null);
      out[key] = branchRow ? branchRow.value : pharmacyRow ? pharmacyRow.value : meta?.def.defaultValue ?? null;
    }
    return out;
  }

  // =========================================================================
  // Write contract
  // =========================================================================
  async set(key: string, value: unknown, params: { pharmacyId: string; branchId?: string; updatedBy: string }): Promise<void> {
    const meta = this.defs.get(key);
    if (!meta) throw new NotFoundException({ errorCode: 'SETTING_NOT_FOUND', message: `Unknown setting "${key}".` });
    if (params.branchId && (meta.def.scope ?? 'PHARMACY') !== SettingScope.BRANCH) {
      throw new BadRequestException({ errorCode: 'NOT_BRANCH_SCOPED', message: `Setting "${key}" is pharmacy-wide and cannot have a branch override.` });
    }
    await this.validate(meta.def, value, params);

    const existing = await this.prisma.settingValue.findFirst({ where: { pharmacyId: params.pharmacyId, branchId: params.branchId ?? null, settingKey: key } });
    const oldValue = existing?.value ?? null;
    if (existing) await this.prisma.settingValue.update({ where: { id: existing.id }, data: { value: value as Prisma.InputJsonValue, updatedBy: params.updatedBy } });
    else await this.prisma.settingValue.create({ data: { pharmacyId: params.pharmacyId, branchId: params.branchId ?? null, settingKey: key, value: value as Prisma.InputJsonValue, updatedBy: params.updatedBy } });

    await this.prisma.settingChangeHistory.create({ data: { pharmacyId: params.pharmacyId, branchId: params.branchId ?? null, settingKey: key, oldValue: (oldValue ?? Prisma.JsonNull) as Prisma.InputJsonValue, newValue: value as Prisma.InputJsonValue, changedBy: params.updatedBy } });
    this.invalidate(params.pharmacyId, params.branchId, key);
    await this.audit.record({ pharmacyId: params.pharmacyId, branchId: params.branchId, userId: params.updatedBy, action: 'SETTING_CHANGED', entityType: 'SETTING', entityId: key, severity: 'SENSITIVE', metadata: { key, before: oldValue, after: value, branch: params.branchId ?? 'pharmacy-wide' } });
  }

  async resetToDefault(key: string, params: { pharmacyId: string; branchId?: string; updatedBy: string }): Promise<void> {
    const meta = this.defs.get(key);
    if (!meta) throw new NotFoundException({ errorCode: 'SETTING_NOT_FOUND', message: `Unknown setting "${key}".` });
    const existing = await this.prisma.settingValue.findFirst({ where: { pharmacyId: params.pharmacyId, branchId: params.branchId ?? null, settingKey: key } });
    if (existing) {
      await this.prisma.settingValue.delete({ where: { id: existing.id } });
      await this.prisma.settingChangeHistory.create({ data: { pharmacyId: params.pharmacyId, branchId: params.branchId ?? null, settingKey: key, oldValue: existing.value as Prisma.InputJsonValue, newValue: meta.def.defaultValue as Prisma.InputJsonValue, changedBy: params.updatedBy } });
    }
    this.invalidate(params.pharmacyId, params.branchId, key);
    await this.audit.record({ pharmacyId: params.pharmacyId, branchId: params.branchId, userId: params.updatedBy, action: 'SETTING_RESET_TO_DEFAULT', entityType: 'SETTING', entityId: key, severity: 'SENSITIVE', metadata: { key } });
  }

  private invalidate(pharmacyId: string, branchId: string | undefined, key: string): void {
    // Invalidate the exact key + both scopes (a pharmacy-wide change affects
    // branches that fall through to it).
    this.cache.delete(this.cacheKey(pharmacyId, branchId, key));
    this.cache.delete(this.cacheKey(pharmacyId, undefined, key));
  }

  // =========================================================================
  // Validation
  // =========================================================================
  private async validate(def: SettingDefinitionInput, value: unknown, params: { pharmacyId: string; branchId?: string }): Promise<void> {
    const rule = def.validationRule ?? {};
    const fail = (msg: string) => { throw new BadRequestException({ errorCode: 'INVALID_SETTING_VALUE', message: msg }); };

    switch (def.valueType) {
      case 'NUMBER': {
        if (typeof value !== 'number' || Number.isNaN(value)) fail(`${def.label} must be a number.`);
        const v = value as number;
        if (rule.min !== undefined && v < (rule.min as number)) fail(`${def.label} must be ≥ ${rule.min}.`);
        if (rule.max !== undefined && v > (rule.max as number)) fail(`${def.label} must be ≤ ${rule.max}.`);
        // Paired-threshold: e.g. variance warn ≤ block.
        if (rule.lessThanOrEqualKey) {
          const other = (await this.get<number>(rule.lessThanOrEqualKey as string, params)) ?? Infinity;
          if (v > other) fail(`${def.label} must be ≤ the related "${rule.lessThanOrEqualKey}" value (${other}).`);
        }
        break;
      }
      case 'BOOLEAN':
        if (typeof value !== 'boolean') fail(`${def.label} must be true or false.`);
        break;
      case 'ENUM':
        if (!(rule.allowedValues as unknown[])?.includes(value)) fail(`${def.label} must be one of: ${(rule.allowedValues as string[]).join(', ')}.`);
        break;
      case 'STRING':
        if (typeof value !== 'string') fail(`${def.label} must be text.`);
        if (rule.maxLength !== undefined && (value as string).length > (rule.maxLength as number)) fail(`${def.label} is too long (max ${rule.maxLength}).`);
        break;
      case 'JSON':
        if (rule.expiryTiers) {
          const t = value as { red?: number; orange?: number; yellow?: number };
          if (!t || typeof t.red !== 'number' || typeof t.orange !== 'number' || typeof t.yellow !== 'number') fail('Expiry tiers need numeric red/orange/yellow day values.');
          if (!(t.red! < t.orange! && t.orange! < t.yellow!)) fail('Expiry tiers must ascend: red < orange < yellow.');
        }
        break;
    }
  }

  // =========================================================================
  // Admin / UI reads
  // =========================================================================
  async listGrouped(pharmacyId: string, branchId?: string) {
    const defs = await this.prisma.settingDefinition.findMany({ orderBy: [{ category: 'asc' }, { label: 'asc' }] });
    const values = await this.prisma.settingValue.findMany({ where: { pharmacyId } });
    const byKey = new Map<string, { pharmacy?: unknown; branch?: unknown }>();
    for (const v of values) {
      const e = byKey.get(v.settingKey) ?? {};
      if (v.branchId === null) e.pharmacy = v.value;
      else if (v.branchId === branchId) e.branch = v.value;
      byKey.set(v.settingKey, e);
    }
    const grouped: Record<string, unknown[]> = {};
    for (const d of defs) {
      const cur = byKey.get(d.key) ?? {};
      const resolved = cur.branch ?? cur.pharmacy ?? d.defaultValue;
      const item = {
        key: d.key, label: d.label, description: d.description, category: d.category, valueType: d.valueType,
        defaultValue: d.defaultValue, validationRule: d.validationRule, scope: d.scope, isSensitive: d.isSensitive,
        resolvedValue: d.isSensitive && (cur.pharmacy || cur.branch) ? '••••••' : resolved,
        isCustomized: cur.pharmacy !== undefined || cur.branch !== undefined,
        branchOverride: cur.branch ?? null,
        pharmacyValue: cur.pharmacy ?? null,
      };
      (grouped[d.category] ??= []).push(item);
    }
    return grouped;
  }

  async getDefinitions() {
    return this.prisma.settingDefinition.findMany({ orderBy: [{ category: 'asc' }, { label: 'asc' }] });
  }

  async history(pharmacyId: string, key: string) {
    const rows = await this.prisma.settingChangeHistory.findMany({ where: { pharmacyId, settingKey: key }, orderBy: { changedAt: 'desc' }, take: 50 });
    return rows.map((r) => ({ id: r.id, oldValue: r.oldValue, newValue: r.newValue, changedBy: r.changedBy, changedAt: r.changedAt.toISOString(), branchId: r.branchId }));
  }

  /** Convenience: does this key exist + is it purchases-category (for delegated RBAC)? */
  categoryOf(key: string): string | undefined {
    return this.defs.get(key)?.def.category;
  }
}
