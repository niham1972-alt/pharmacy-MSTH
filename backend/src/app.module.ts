import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuditLogModule } from './common/audit/audit-log.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MedicinesModule } from './modules/medicines/medicines.module';
import { MedicineLookupsModule } from './modules/medicine-lookups/medicine-lookups.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { SalesModule } from './modules/sales/sales.module';
import { CustomersModule } from './modules/customers/customers.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { BatchesModule } from './modules/batches/batches.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { UsersModule } from './modules/users/users.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SalesReturnsModule } from './modules/sales-returns/sales-returns.module';
import { PurchaseReturnsModule } from './modules/purchase-returns/purchase-returns.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 60,
      },
    ]),
    PrismaModule,
    AuditLogModule,
    DashboardModule,
    MedicinesModule,
    MedicineLookupsModule,
    PurchasesModule,
    SalesModule,
    CustomersModule,
    InventoryModule,
    BatchesModule,
    SuppliersModule,
    UsersModule,
    AuditLogsModule,
    SettingsModule,
    SalesReturnsModule,
    PurchaseReturnsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
