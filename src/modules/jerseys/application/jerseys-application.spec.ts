import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type { IdGeneratorPort } from '@core/id-generator/id-generator.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { InsufficientStockError } from '../errors/insufficient-stock.error';
import { JerseyScopeNotFoundError } from '../errors/jersey-scope-not-found.error';
import { JerseyValidationError } from '../errors/jersey-validation.error';
import { JerseyVersionConflictError } from '../errors/jersey-version-conflict.error';
import { NumberCollisionError } from '../errors/number-collision.error';
import { OrderInvalidTransitionError } from '../errors/order-invalid-transition.error';
import { OrderLockedError } from '../errors/order-locked.error';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import type { JerseyInventoryRepository } from '../infrastructure/jersey-inventory.repository';
import type { JerseyOrderRepository } from '../infrastructure/jersey-order.repository';
import type { JerseyProductRepository } from '../infrastructure/jersey-product.repository';
import type { JerseyScopeRepository } from '../infrastructure/jersey-scope.repository';
import type { NumberReservationRepository } from '../infrastructure/number-reservation.repository';
import {
  IssueDirection,
  JerseyDivision,
  JerseySize,
  KitType,
  OrderStatus,
  OrderTransition,
  PaymentStatus,
  SleeveType,
} from '../model/jerseys.enums';
import type {
  JerseyInventory,
  JerseyOrder,
  JerseyProduct,
  NumberReservation,
  OrderItem,
} from '../model/jerseys.types';
import { CreateProductUseCase } from './create-product.use-case';
import { IssueStockUseCase } from './issue-stock.use-case';
import { JerseyLookupService } from './jersey-lookup.service';
import { JerseyQueryService } from './jersey-query.service';
import { ManageOrderUseCase } from './manage-order.use-case';
import { ManageReservationUseCase } from './manage-reservation.use-case';
import { SupplierExportService } from './supplier-export.service';

const NOW = new Date('2025-03-01T00:00:00.000Z');
const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const CLOCK: ClockPort = { now: () => NOW, uptime: () => 0 };
let counter = 0;
const IDS: IdGeneratorPort = {
  generate: () => {
    counter += 1;
    return `generated-${counter}`;
  },
};
const ACTOR: AuthUserIdentity = {
  userId: 'user-1',
  email: 'admin@example.test',
  roles: [],
};

const PRODUCT: JerseyProduct = {
  productId: 'product-1',
  teamId: 'team-1',
  seasonId: null,
  productKey: 'home',
  name: 'Home',
  kitType: KitType.Home,
  supplier: null,
  customizable: true,
  status: 'active' as JerseyProduct['status'],
  createdBy: 'user-1',
  createdAt: NOW,
  updatedAt: NOW,
};

const RESERVATION: NumberReservation = {
  reservationId: 'res-1',
  teamId: 'team-1',
  seasonId: 'season-1',
  division: JerseyDivision.Open,
  number: 7,
  membershipId: 'member-1',
  printedName: 'ALI',
  normalizedName: 'ALI',
  status: 'active' as NumberReservation['status'],
  activeFrom: NOW,
  releasedAt: null,
  releaseReason: null,
  recordVersion: 1,
  createdBy: 'user-1',
  createdAt: NOW,
  updatedAt: NOW,
};

const ORDER: JerseyOrder = {
  orderId: 'order-1',
  teamId: 'team-1',
  seasonId: 'season-1',
  reference: 'ORD-1',
  supplier: null,
  status: OrderStatus.Draft,
  paymentStatus: PaymentStatus.Unset,
  external: false,
  notes: null,
  recordVersion: 1,
  createdBy: 'user-1',
  submittedAt: null,
  approvedAt: null,
  orderedAt: null,
  receivedAt: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const ITEM: OrderItem = {
  itemId: 'item-1',
  teamId: 'team-1',
  orderId: 'order-1',
  productId: 'product-1',
  membershipId: null,
  kitType: KitType.Home,
  size: JerseySize.Medium,
  sleeves: SleeveType.Short,
  division: JerseyDivision.Open,
  printedName: 'ALI',
  number: 7,
  quantity: 1,
  createdAt: NOW,
};

const INVENTORY: JerseyInventory = {
  inventoryId: 'inv-1',
  teamId: 'team-1',
  productId: 'product-1',
  size: JerseySize.Medium,
  kitType: KitType.Home,
  onHand: 9,
  issued: 1,
  returned: 0,
  recordVersion: 1,
  createdAt: NOW,
  updatedAt: NOW,
};

function auditStub(): AuditRecorderService {
  return {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditRecorderService;
}

function eventsStub(): RecordDomainEventService {
  return {
    enqueue: vi.fn().mockResolvedValue(undefined),
  } as unknown as RecordDomainEventService;
}

function scopeRepo(
  overrides: Record<string, unknown> = {},
): JerseyScopeRepository {
  return {
    activeTeamExists: vi.fn().mockResolvedValue(true),
    seasonExists: vi.fn().mockResolvedValue(true),
    membershipExists: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function productRepo(
  overrides: Record<string, unknown> = {},
): JerseyProductRepository {
  return {
    insert: vi.fn().mockResolvedValue(PRODUCT),
    findForWrite: vi.fn().mockResolvedValue(PRODUCT),
    listForTeam: vi.fn().mockResolvedValue([PRODUCT]),
    countForTeam: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function reservationRepo(
  overrides: Record<string, unknown> = {},
): NumberReservationRepository {
  return {
    insert: vi.fn().mockResolvedValue(RESERVATION),
    findForWrite: vi.fn().mockResolvedValue(RESERVATION),
    findActive: vi.fn().mockResolvedValue(null),
    release: vi.fn().mockResolvedValue({ ...RESERVATION, status: 'released' }),
    listForScope: vi.fn().mockResolvedValue([RESERVATION]),
    countForScope: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as NumberReservationRepository;
}

function orderRepo(
  overrides: Record<string, unknown> = {},
): JerseyOrderRepository {
  return {
    insert: vi.fn().mockResolvedValue(ORDER),
    findForWrite: vi.fn().mockResolvedValue(ORDER),
    applyStatusChange: vi
      .fn()
      .mockResolvedValue({ ...ORDER, status: OrderStatus.Submitted }),
    insertItem: vi.fn().mockResolvedValue(ITEM),
    listItems: vi.fn().mockResolvedValue([ITEM]),
    listForScope: vi.fn().mockResolvedValue([ORDER]),
    countForScope: vi.fn().mockResolvedValue(1),
    supplierExport: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as JerseyOrderRepository;
}

function inventoryRepo(
  overrides: Record<string, unknown> = {},
): JerseyInventoryRepository {
  return {
    ensureVariant: vi
      .fn()
      .mockResolvedValue({ ...INVENTORY, onHand: 10, issued: 0 }),
    applyMovement: vi.fn().mockResolvedValue(INVENTORY),
    insertIssue: vi.fn().mockResolvedValue('issue-1'),
    listForTeam: vi.fn().mockResolvedValue([INVENTORY]),
    countForTeam: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function lookup(
  overrides: {
    scopes?: JerseyScopeRepository;
    products?: JerseyProductRepository;
    reservations?: NumberReservationRepository;
    orders?: JerseyOrderRepository;
  } = {},
): JerseyLookupService {
  return new JerseyLookupService(
    overrides.scopes ?? scopeRepo(),
    overrides.products ?? productRepo(),
    overrides.reservations ?? reservationRepo(),
    overrides.orders ?? orderRepo(),
  );
}

describe('JerseyLookupService', () => {
  it('hides a foreign product and validates scope', async () => {
    await expect(
      lookup({
        products: productRepo({
          findForWrite: vi.fn().mockResolvedValue(null),
        }),
      }).requireProduct(TX, 'team-1', 'product-9'),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
    await expect(
      lookup({
        scopes: scopeRepo({ seasonExists: vi.fn().mockResolvedValue(false) }),
      }).requireSeason(TX, 'team-1', 'season-9'),
    ).rejects.toBeInstanceOf(JerseyScopeNotFoundError);
  });
});

describe('JerseyQueryService', () => {
  function build() {
    return new JerseyQueryService(
      UOW,
      productRepo(),
      reservationRepo(),
      orderRepo(),
      inventoryRepo(),
      lookup(),
    );
  }

  it('returns bounded pages for every entity', async () => {
    const service = build();
    expect(
      (await service.listProducts('team-1', { limit: 20, offset: 0 })).total,
    ).toBe(1);
    expect(
      (
        await service.listReservations(
          'team-1',
          { seasonId: null, division: null, status: null, membershipId: null },
          { limit: 20, offset: 0 },
        )
      ).total,
    ).toBe(1);
    expect(
      (
        await service.listOrders(
          'team-1',
          { seasonId: null, status: null },
          { limit: 20, offset: 0 },
        )
      ).total,
    ).toBe(1);
    expect((await service.getOrder('team-1', 'order-1')).orderId).toBe(
      'order-1',
    );
    expect(
      (await service.listOrderItems('team-1', 'order-1')).items,
    ).toHaveLength(1);
    expect(
      (await service.listInventory('team-1', { limit: 20, offset: 0 })).total,
    ).toBe(1);
  });
});

describe('CreateProductUseCase', () => {
  it('creates a product under the resolved scope', async () => {
    const products = productRepo();
    const useCase = new CreateProductUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({ products }),
      products,
      auditStub(),
    );
    expect(
      (
        await useCase.execute(ACTOR, 'team-1', {
          content: {
            seasonId: null,
            productKey: 'home',
            name: 'Home',
            kitType: KitType.Home,
            supplier: null,
            customizable: true,
          },
        })
      ).productKey,
    ).toBe('home');
  });
});

describe('ManageReservationUseCase', () => {
  function build(reservations = reservationRepo()) {
    return new ManageReservationUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup({ reservations }),
      reservations,
      auditStub(),
    );
  }

  const content = {
    content: {
      seasonId: 'season-1',
      division: JerseyDivision.Open,
      number: 7,
      membershipId: 'member-1',
      printedName: 'ALI',
    },
  };

  it('reserves a free number', async () => {
    const reservations = reservationRepo();
    expect(
      (await build(reservations).create(ACTOR, 'team-1', content)).number,
    ).toBe(7);
  });

  it('refuses a number already held in scope', async () => {
    await expect(
      build(
        reservationRepo({ findActive: vi.fn().mockResolvedValue(RESERVATION) }),
      ).create(ACTOR, 'team-1', content),
    ).rejects.toBeInstanceOf(NumberCollisionError);
  });

  it('releases a reservation and reports a version conflict', async () => {
    expect(
      (
        await build().release(ACTOR, 'team-1', 'res-1', {
          reason: 'left',
          expectedRecordVersion: 1,
        })
      ).status,
    ).toBe('released');
    await expect(
      build(
        reservationRepo({ release: vi.fn().mockResolvedValue(null) }),
      ).release(ACTOR, 'team-1', 'res-1', {
        reason: 'left',
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(JerseyVersionConflictError);
  });
});

describe('ManageOrderUseCase', () => {
  function build(
    orders = orderRepo(),
    products = productRepo(),
    events = eventsStub(),
  ) {
    return {
      events,
      orders,
      useCase: new ManageOrderUseCase(
        UOW,
        CLOCK,
        IDS,
        lookup({ orders, products }),
        orders,
        auditStub(),
        events,
      ),
    };
  }

  it('creates an order and adds a validated item to a draft', async () => {
    const { useCase, orders } = build();
    await useCase.create(ACTOR, 'team-1', {
      content: {
        seasonId: 'season-1',
        reference: 'ORD-1',
        supplier: null,
        paymentStatus: PaymentStatus.Unset,
        external: false,
        notes: null,
      },
    });
    expect(orders.insert).toHaveBeenCalledTimes(1);
    await useCase.addItem(ACTOR, 'team-1', 'order-1', {
      content: {
        productId: 'product-1',
        membershipId: null,
        kitType: KitType.Home,
        size: JerseySize.Medium,
        sleeves: SleeveType.Short,
        division: JerseyDivision.Open,
        printedName: 'ALI',
        number: 7,
        quantity: 1,
      },
    });
    expect(orders.insertItem).toHaveBeenCalledTimes(1);
  });

  it('refuses to add an item to a non-draft order', async () => {
    const { useCase } = build(
      orderRepo({
        findForWrite: vi
          .fn()
          .mockResolvedValue({ ...ORDER, status: OrderStatus.Submitted }),
      }),
    );
    await expect(
      useCase.addItem(ACTOR, 'team-1', 'order-1', {
        content: {
          productId: 'product-1',
          membershipId: null,
          kitType: KitType.Home,
          size: JerseySize.Medium,
          sleeves: SleeveType.Short,
          division: JerseyDivision.Open,
          printedName: 'ALI',
          number: 7,
          quantity: 1,
        },
      }),
    ).rejects.toBeInstanceOf(OrderLockedError);
  });

  it('rejects an invalid item', async () => {
    const { useCase } = build();
    await expect(
      useCase.addItem(ACTOR, 'team-1', 'order-1', {
        content: {
          productId: 'product-1',
          membershipId: null,
          kitType: KitType.Home,
          size: JerseySize.Medium,
          sleeves: SleeveType.Short,
          division: JerseyDivision.Open,
          printedName: 'ALI',
          number: 5000,
          quantity: 1,
        },
      }),
    ).rejects.toBeInstanceOf(JerseyValidationError);
  });

  it('completes an order and emits the event', async () => {
    const { useCase, events } = build(
      orderRepo({
        findForWrite: vi
          .fn()
          .mockResolvedValue({ ...ORDER, status: OrderStatus.Issued }),
        applyStatusChange: vi
          .fn()
          .mockResolvedValue({ ...ORDER, status: OrderStatus.Completed }),
      }),
    );
    await useCase.transition(ACTOR, 'team-1', 'order-1', {
      transition: OrderTransition.Complete,
      expectedRecordVersion: 1,
    });
    expect(events.enqueue).toHaveBeenCalledTimes(1);
  });

  it('refuses an illegal transition and reports a conflict', async () => {
    const { useCase } = build(
      orderRepo({
        findForWrite: vi
          .fn()
          .mockResolvedValue({ ...ORDER, status: OrderStatus.Completed }),
      }),
    );
    await expect(
      useCase.transition(ACTOR, 'team-1', 'order-1', {
        transition: OrderTransition.Submit,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(OrderInvalidTransitionError);
    const conflict = build(
      orderRepo({ applyStatusChange: vi.fn().mockResolvedValue(null) }),
    );
    await expect(
      conflict.useCase.transition(ACTOR, 'team-1', 'order-1', {
        transition: OrderTransition.Submit,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(JerseyVersionConflictError);
  });
});

describe('SupplierExportService', () => {
  it('returns a privacy-minimal export', async () => {
    const orders = orderRepo({
      supplierExport: vi.fn().mockResolvedValue([
        {
          productName: 'Home',
          kitType: KitType.Home,
          size: JerseySize.Medium,
          sleeves: SleeveType.Short,
          printedName: 'ALI',
          number: 7,
          quantity: 1,
        },
      ]),
    });
    const service = new SupplierExportService(UOW, orders, lookup({ orders }));
    const result = await service.forOrder('team-1', 'order-1');
    expect(result.reference).toBe('ORD-1');
    expect(result.lines[0]).not.toHaveProperty('membershipId');
  });
});

describe('IssueStockUseCase', () => {
  function build(inventory = inventoryRepo()) {
    return new IssueStockUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup(),
      inventory,
      auditStub(),
    );
  }

  const content = {
    content: {
      productId: 'product-1',
      membershipId: 'member-1',
      size: JerseySize.Medium,
      kitType: KitType.Home,
      number: null,
      direction: IssueDirection.Issue,
      quantity: 1,
    },
  };

  it('issues stock and appends the issue ledger row', async () => {
    const inventory = inventoryRepo();
    expect(
      (await build(inventory).execute(ACTOR, 'team-1', content)).onHand,
    ).toBe(9);
    expect(inventory.insertIssue).toHaveBeenCalledTimes(1);
  });

  it('refuses an over-issue', async () => {
    await expect(
      build(
        inventoryRepo({ applyMovement: vi.fn().mockResolvedValue(null) }),
      ).execute(ACTOR, 'team-1', content),
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });

  it('records a return', async () => {
    const inventory = inventoryRepo();
    await build(inventory).execute(ACTOR, 'team-1', {
      content: { ...content.content, direction: IssueDirection.Return },
    });
    expect(inventory.applyMovement).toHaveBeenCalledWith(
      TX,
      'inv-1',
      1,
      0,
      1,
      NOW,
    );
  });
});
