import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CostingRule } from '../purchase-config.service';

function dec(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : v.toNumber();
}

/**
 * Updates `Medicine.costPrice` (Module 2's field) on receipt per the configured
 * costing rule, and records a `PriceHistory` row when the cost actually changes
 * (spec §11 — price history is immutable and atomic with the change). Weighted
 * average correctly dilutes with free/bonus units (received at zero cost).
 * Reads the pre-receipt stock/cost passed by the caller so ordering with the
 * stock increment doesn't matter.
 */
@Injectable()
export class MedicineCostSyncService {
  async applyCosting(
    tx: Prisma.TransactionClient,
    p: {
      pharmacyId: string;
      medicineId: string;
      oldStock: number;
      oldCost: number;
      actualUnitCost: number;
      receivedQuantity: number;
      freeQuantity: number;
      rule: CostingRule;
      changedBy: string;
    },
  ): Promise<number> {
    if (p.rule === 'MANUAL_ONLY') return p.oldCost;

    let newCost = p.oldCost;
    if (p.rule === 'LATEST_COST') {
      newCost = p.actualUnitCost;
    } else if (p.rule === 'WEIGHTED_AVERAGE') {
      const incomingUnits = p.receivedQuantity + p.freeQuantity; // free units dilute cost
      const totalUnits = p.oldStock + incomingUnits;
      if (totalUnits > 0) {
        const totalValue = p.oldStock * p.oldCost + p.receivedQuantity * p.actualUnitCost; // free = 0 value
        newCost = totalValue / totalUnits;
      }
    }

    newCost = Math.round(newCost * 100) / 100;
    if (newCost === p.oldCost) return p.oldCost;

    await tx.medicine.update({ where: { id: p.medicineId }, data: { costPrice: newCost } });
    await tx.priceHistory.create({
      data: {
        medicineId: p.medicineId,
        pharmacyId: p.pharmacyId,
        priceType: 'COST',
        oldValue: p.oldCost,
        newValue: newCost,
        changedBy: p.changedBy,
        reason: `Goods receipt (${p.rule})`,
      },
    });
    return newCost;
  }

  toNumber = dec;
}
