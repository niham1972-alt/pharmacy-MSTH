import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { JwtVerifierModule } from './common/auth/jwt-verifier.module';
import { PlatformModule } from './platform/platform.module';
import { TenantIsolationMiddleware } from './platform/middleware/tenant-isolation.middleware';
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
import { StockAdjustmentsModule } from './modules/stock-adjustments/stock-adjustments.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StorageModule } from './modules/storage/storage.module';
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
    JwtVerifierModule,
    PlatformModule,
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
    StockAdjustmentsModule,
    ExpensesModule,
    ReportsModule,
    StorageModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  // Defense-in-depth: the tenant-isolation middleware sits in front of EVERY
  // tenant-facing request (Modules 1–18) and rejects any that reference a
  // pharmacyId other than the token's. Platform routes are exempted inside it.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantIsolationMiddleware).forRoutes('*');
  }
}
