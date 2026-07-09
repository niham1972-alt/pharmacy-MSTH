import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SalesService } from '../../sales/sales.service';

/**
 * Updates the original Sale's status via Module 4's OWN narrow method
 * (`markReturnStatus`) rather than writing to Module 4's tables directly —
 * the same ownership boundary kept between Modules 3/4/5/6.
 */
@Injectable()
export class SaleStatusSyncService {
  constructor(private readonly sales: SalesService) {}

  sync(tx: Prisma.TransactionClient, pharmacyId: string, saleId: string, fullyReturned: boolean) {
    return this.sales.markReturnStatus(tx, pharmacyId, saleId, fullyReturned);
  }
}
