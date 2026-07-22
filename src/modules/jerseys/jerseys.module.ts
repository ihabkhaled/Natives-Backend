import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { JerseyInventoryController } from './api/jersey-inventory.controller';
import { JerseyOrdersController } from './api/jersey-orders.controller';
import { JerseyProductsController } from './api/jersey-products.controller';
import { NumberReservationsController } from './api/number-reservations.controller';
import { CreateProductUseCase } from './application/create-product.use-case';
import { IssueStockUseCase } from './application/issue-stock.use-case';
import { JerseyLookupService } from './application/jersey-lookup.service';
import { JerseyQueryService } from './application/jersey-query.service';
import { ManageOrderUseCase } from './application/manage-order.use-case';
import { ManageReservationUseCase } from './application/manage-reservation.use-case';
import { SupplierExportService } from './application/supplier-export.service';
import { JerseyInventoryRepository } from './infrastructure/jersey-inventory.repository';
import { JerseyOrderRepository } from './infrastructure/jersey-order.repository';
import { JerseyProductRepository } from './infrastructure/jersey-product.repository';
import { JerseyScopeRepository } from './infrastructure/jersey-scope.repository';
import { NumberReservationRepository } from './infrastructure/number-reservation.repository';

/**
 * Jerseys, apparel orders, number reservations, inventory, and fulfillment
 * (UN-604). Owns its persistence (raw SQL via the global UnitOfWorkPort) and
 * composes the platform audit + outbox primitives so every write commits
 * atomically with its `jersey.*` events.
 *
 * Two invariants shape the module. Jersey uniqueness is SCOPED by
 * team/season/division and history persists: a released number is recoverable,
 * and a profile preference, a confirmed order, and issued inventory are three
 * DISTINCT records. Finance is minimal and safe: the application stores no
 * payment card data — only a coarse payment status — and the supplier export
 * carries print facts only, never a member identity.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule],
  controllers: [
    JerseyProductsController,
    NumberReservationsController,
    JerseyOrdersController,
    JerseyInventoryController,
  ],
  providers: [
    JerseyScopeRepository,
    JerseyProductRepository,
    NumberReservationRepository,
    JerseyOrderRepository,
    JerseyInventoryRepository,
    JerseyLookupService,
    JerseyQueryService,
    SupplierExportService,
    CreateProductUseCase,
    ManageReservationUseCase,
    ManageOrderUseCase,
    IssueStockUseCase,
  ],
})
export class JerseysModule {}
