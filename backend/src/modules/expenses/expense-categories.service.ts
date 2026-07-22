import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/expense-category.dto';
import { DEFAULT_CATEGORY_LABELS, DEFAULT_EXPENSE_CATEGORIES } from './default-categories';

@Injectable()
export class ExpenseCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Lazily seed the default category set for a tenant the first time expenses are
   * touched (spec §22 — sensible defaults per new pharmacy). Idempotent: the
   * (pharmacyId, name, parentId) unique index makes a re-run a no-op via skipDuplicates.
   */
  async ensureDefaults(pharmacyId: string): Promise<void> {
    const existing = await this.prisma.expenseCategory.count({ where: { pharmacyId } });
    if (existing > 0) return;
    await this.prisma.expenseCategory.createMany({
      data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ pharmacyId, name })),
      skipDuplicates: true,
    });
  }

  /** Resolve + validate a category belongs to the pharmacy and is active. */
  async requireActive(pharmacyId: string, categoryId: string) {
    const cat = await this.prisma.expenseCategory.findFirst({ where: { id: categoryId, pharmacyId } });
    if (!cat) throw new BadRequestException({ errorCode: 'INVALID_CATEGORY', message: 'Expense category not found.' });
    if (!cat.isActive) throw new BadRequestException({ errorCode: 'CATEGORY_INACTIVE', message: `Category "${cat.name}" is inactive and cannot take new expenses.` });
    return cat;
  }

  async list(user: AuthenticatedUser) {
    await this.ensureDefaults(user.pharmacyId);
    const cats = await this.prisma.expenseCategory.findMany({ where: { pharmacyId: user.pharmacyId }, orderBy: { name: 'asc' } });
    // Dependent counts drive the soft-restrict-on-delete UX (spec §21).
    const [expenseCounts, templateCounts] = await Promise.all([
      this.prisma.expense.groupBy({ by: ['categoryId'], where: { pharmacyId: user.pharmacyId }, _count: { _all: true } }),
      this.prisma.recurringExpenseTemplate.groupBy({ by: ['categoryId'], where: { pharmacyId: user.pharmacyId }, _count: { _all: true } }),
    ]);
    const eBy = new Map(expenseCounts.map((c) => [c.categoryId, c._count._all]));
    const tBy = new Map(templateCounts.map((c) => [c.categoryId, c._count._all]));
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      label: DEFAULT_CATEGORY_LABELS[c.name] ?? c.name,
      parentId: c.parentId,
      isActive: c.isActive,
      expenseCount: eBy.get(c.id) ?? 0,
      templateCount: tBy.get(c.id) ?? 0,
    }));
  }

  async create(user: AuthenticatedUser, dto: CreateCategoryDto) {
    if (dto.parentId) {
      const parent = await this.prisma.expenseCategory.findFirst({ where: { id: dto.parentId, pharmacyId: user.pharmacyId } });
      if (!parent) throw new BadRequestException({ errorCode: 'INVALID_PARENT', message: 'Parent category not found.' });
    }
    try {
      const cat = await this.prisma.expenseCategory.create({
        data: { pharmacyId: user.pharmacyId, name: dto.name.trim(), parentId: dto.parentId ?? null },
      });
      await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'EXPENSE_CATEGORY_CREATED', entityType: 'EXPENSE_CATEGORY', entityId: cat.id, metadata: { name: cat.name } });
      return { id: cat.id, name: cat.name, parentId: cat.parentId, isActive: cat.isActive };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ errorCode: 'CATEGORY_EXISTS', message: `A category named "${dto.name}" already exists.` });
      }
      throw e;
    }
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateCategoryDto) {
    const cat = await this.prisma.expenseCategory.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
    if (!cat) throw new NotFoundException({ errorCode: 'CATEGORY_NOT_FOUND', message: 'Category not found.' });
    try {
      const updated = await this.prisma.expenseCategory.update({
        where: { id },
        data: { ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) },
      });
      await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'EXPENSE_CATEGORY_UPDATED', entityType: 'EXPENSE_CATEGORY', entityId: id, metadata: { name: updated.name, isActive: updated.isActive } });
      return { id: updated.id, name: updated.name, parentId: updated.parentId, isActive: updated.isActive };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ errorCode: 'CATEGORY_EXISTS', message: `A category named "${dto.name}" already exists.` });
      }
      throw e;
    }
  }

  /**
   * Delete-guard (spec §21): a category referenced by any expense/template/child is
   * NOT hard-deleted (that would orphan financial history) — it's deactivated
   * instead. Only a truly-unused category is removed outright.
   */
  async remove(user: AuthenticatedUser, id: string) {
    const cat = await this.prisma.expenseCategory.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
    if (!cat) throw new NotFoundException({ errorCode: 'CATEGORY_NOT_FOUND', message: 'Category not found.' });
    const [expenses, templates, children] = await Promise.all([
      this.prisma.expense.count({ where: { categoryId: id } }),
      this.prisma.recurringExpenseTemplate.count({ where: { categoryId: id } }),
      this.prisma.expenseCategory.count({ where: { parentId: id } }),
    ]);
    const dependents = expenses + templates + children;
    if (dependents > 0) {
      await this.prisma.expenseCategory.update({ where: { id }, data: { isActive: false } });
      await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'EXPENSE_CATEGORY_DELETED', entityType: 'EXPENSE_CATEGORY', entityId: id, metadata: { name: cat.name, softDeleted: true, dependents } });
      return { id, deactivated: true, message: `Category "${cat.name}" is in use (${dependents} linked record(s)) and was deactivated instead of deleted.` };
    }
    await this.prisma.expenseCategory.delete({ where: { id } });
    await this.audit.record({ pharmacyId: user.pharmacyId, branchId: user.branchId, userId: user.userId, action: 'EXPENSE_CATEGORY_DELETED', entityType: 'EXPENSE_CATEGORY', entityId: id, metadata: { name: cat.name, softDeleted: false } });
    return { id, deactivated: false, message: `Category "${cat.name}" deleted.` };
  }
}
