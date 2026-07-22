import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { JerseyOrderRepository } from '../infrastructure/jersey-order.repository';
import type { SupplierExport } from '../model/jerseys.types';
import { JerseyLookupService } from './jersey-lookup.service';

/**
 * Produces the privacy-minimal supplier export for an order (UN-604). The export
 * carries only PRINT facts — product, variant, printed name, number, quantity —
 * and never the member id, finance data, or contact detail, so the file handed
 * to an outside supplier cannot re-identify who each shirt belongs to.
 */
@Injectable()
export class SupplierExportService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly orders: JerseyOrderRepository,
    private readonly lookup: JerseyLookupService,
  ) {}

  forOrder(teamId: string, orderId: string): Promise<SupplierExport> {
    return this.unitOfWork.runInTransaction(async tx => {
      const order = await this.lookup.requireOrder(tx, teamId, orderId);
      const lines = await this.orders.supplierExport(tx, orderId);
      return { orderId: order.orderId, reference: order.reference, lines };
    });
  }
}
