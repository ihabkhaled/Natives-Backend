import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import {
  IssueDirection,
  JerseyDivision,
  JerseySize,
  KitType,
  OrderStatus,
  PaymentStatus,
  ReservationStatus,
  SleeveType,
} from '../model/jerseys.enums';
import type {
  InventoryRow,
  OrderItemRow,
  OrderRow,
  ProductRow,
  ReservationRow,
} from '../model/jerseys.rows';
import { JerseyInventoryRepository } from './jersey-inventory.repository';
import { JerseyOrderRepository } from './jersey-order.repository';
import { JerseyProductRepository } from './jersey-product.repository';
import { JerseyScopeRepository } from './jersey-scope.repository';
import { NumberReservationRepository } from './number-reservation.repository';

const NOW = new Date('2025-03-01T00:00:00.000Z');

const PRODUCT_ROW: ProductRow = {
  id: 'product-1',
  team_id: 'team-1',
  season_id: null,
  product_key: 'home',
  name: 'Home',
  kit_type: 'home',
  supplier: null,
  customizable: true,
  status: 'active',
  created_by: 'user-1',
  created_at: NOW,
  updated_at: NOW,
};

const RESERVATION_ROW: ReservationRow = {
  id: 'res-1',
  team_id: 'team-1',
  season_id: 'season-1',
  division: 'open',
  number: 7,
  membership_id: 'member-1',
  printed_name: 'ALI',
  normalized_name: 'ALI',
  status: 'active',
  active_from: NOW,
  released_at: null,
  release_reason: null,
  record_version: 1,
  created_by: 'user-1',
  created_at: NOW,
  updated_at: NOW,
};

const ORDER_ROW: OrderRow = {
  id: 'order-1',
  team_id: 'team-1',
  season_id: 'season-1',
  reference: 'ORD-1',
  supplier: null,
  status: 'draft',
  payment_status: 'unset',
  external: false,
  notes: null,
  record_version: 1,
  created_by: 'user-1',
  submitted_at: null,
  approved_at: null,
  ordered_at: null,
  received_at: null,
  completed_at: null,
  cancelled_at: null,
  created_at: NOW,
  updated_at: NOW,
};

const ITEM_ROW: OrderItemRow = {
  id: 'item-1',
  team_id: 'team-1',
  order_id: 'order-1',
  product_id: 'product-1',
  membership_id: null,
  kit_type: 'home',
  size: 'm',
  sleeves: 'short',
  division: 'open',
  printed_name: 'ALI',
  number: 7,
  quantity: 1,
  created_at: NOW,
};

const INVENTORY_ROW: InventoryRow = {
  id: 'inv-1',
  team_id: 'team-1',
  product_id: 'product-1',
  size: 'm',
  kit_type: 'home',
  on_hand: 10,
  issued: 0,
  returned: 0,
  record_version: 1,
  created_at: NOW,
  updated_at: NOW,
};

function scopeReturning(...results: unknown[][]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn();
  for (const result of results) {
    run.mockResolvedValueOnce(result);
  }
  run.mockResolvedValue([]);
  return { scope: { run }, run };
}

describe('JerseyScopeRepository', () => {
  const repository = new JerseyScopeRepository();

  it('probes active team, season, and membership', async () => {
    const team = scopeReturning([{ id: 'team-1' }]);
    expect(await repository.activeTeamExists(team.scope, 'team-1')).toBe(true);
    const season = scopeReturning([]);
    expect(
      await repository.seasonExists(season.scope, 'team-1', 'season-9'),
    ).toBe(false);
    const member = scopeReturning([{ id: 'member-1' }]);
    expect(
      await repository.membershipExists(member.scope, 'team-1', 'member-1'),
    ).toBe(true);
  });
});

describe('JerseyProductRepository', () => {
  const repository = new JerseyProductRepository();
  const newProduct = {
    id: 'product-1',
    teamId: 'team-1',
    seasonId: null,
    productKey: 'home',
    name: 'Home',
    kitType: KitType.Home,
    supplier: null,
    customizable: true,
    createdBy: 'user-1',
    now: NOW,
  };

  it('upserts a product and resolves it', async () => {
    const inserted = scopeReturning([PRODUCT_ROW]);
    expect(
      (await repository.insert(inserted.scope, newProduct)).productKey,
    ).toBe('home');
    expect(String(inserted.run.mock.calls[0]?.[0])).toContain('ON CONFLICT');
    const found = scopeReturning([PRODUCT_ROW]);
    expect(
      (await repository.findForWrite(found.scope, 'team-1', 'product-1'))
        ?.productId,
    ).toBe('product-1');
    const missing = scopeReturning([]);
    expect(
      await repository.findForWrite(missing.scope, 'team-1', 'product-9'),
    ).toBeNull();
  });

  it('throws when a product write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.insert(scope, newProduct)).rejects.toThrow(
      /product write/u,
    );
  });

  it('bounds the list and count', async () => {
    const list = scopeReturning([PRODUCT_ROW]);
    expect(
      await repository.listForTeam(list.scope, 'team-1', {
        limit: 900,
        offset: 0,
      }),
    ).toHaveLength(1);
    expect(list.run.mock.calls[0]?.[1]).toContain(100);
    const count = scopeReturning([{ count: 2 }]);
    expect(await repository.countForTeam(count.scope, 'team-1')).toBe(2);
  });
});

describe('NumberReservationRepository', () => {
  const repository = new NumberReservationRepository();
  const newReservation = {
    id: 'res-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    division: JerseyDivision.Open,
    number: 7,
    membershipId: 'member-1',
    printedName: 'ALI',
    normalizedName: 'ALI',
    createdBy: 'user-1',
    now: NOW,
  };

  it('inserts a reservation and finds the active holder of a number', async () => {
    const inserted = scopeReturning([RESERVATION_ROW]);
    expect(
      (await repository.insert(inserted.scope, newReservation)).number,
    ).toBe(7);
    const active = scopeReturning([RESERVATION_ROW]);
    expect(
      (
        await repository.findActive(
          active.scope,
          'team-1',
          'season-1',
          'open',
          7,
        )
      )?.status,
    ).toBe(ReservationStatus.Active);
    const free = scopeReturning([]);
    expect(
      await repository.findActive(free.scope, 'team-1', 'season-1', 'open', 8),
    ).toBeNull();
  });

  it('throws when a reservation write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.insert(scope, newReservation)).rejects.toThrow(
      /reservation write/u,
    );
  });

  it('releases only an active reservation with the right version', async () => {
    const released = scopeReturning([
      { ...RESERVATION_ROW, status: 'released' },
    ]);
    expect(
      (
        await repository.release(
          released.scope,
          'team-1',
          'res-1',
          1,
          'left',
          NOW,
        )
      )?.status,
    ).toBe(ReservationStatus.Released);
    expect(String(released.run.mock.calls[0]?.[0])).toContain(
      `"status" = 'active'`,
    );
    const stale = scopeReturning([]);
    expect(
      await repository.release(stale.scope, 'team-1', 'res-1', 9, 'left', NOW),
    ).toBeNull();
  });

  it('bounds the list and count', async () => {
    const filter = {
      seasonId: null,
      division: null,
      status: null,
      membershipId: null,
    };
    const list = scopeReturning([RESERVATION_ROW]);
    expect(
      await repository.listForScope(list.scope, 'team-1', filter, {
        limit: 900,
        offset: 0,
      }),
    ).toHaveLength(1);
    expect(list.run.mock.calls[0]?.[1]).toContain(100);
    const count = scopeReturning([{ count: 3 }]);
    expect(await repository.countForScope(count.scope, 'team-1', filter)).toBe(
      3,
    );
  });
});

describe('JerseyOrderRepository', () => {
  const repository = new JerseyOrderRepository();
  const newOrder = {
    id: 'order-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    reference: 'ORD-1',
    supplier: null,
    paymentStatus: PaymentStatus.Unset,
    external: false,
    notes: null,
    createdBy: 'user-1',
    now: NOW,
  };

  it('inserts and resolves an order, guards a transition', async () => {
    const inserted = scopeReturning([ORDER_ROW]);
    expect((await repository.insert(inserted.scope, newOrder)).status).toBe(
      OrderStatus.Draft,
    );
    const applied = scopeReturning([{ ...ORDER_ROW, status: 'submitted' }]);
    expect(
      (
        await repository.applyStatusChange(applied.scope, {
          id: 'order-1',
          teamId: 'team-1',
          expectedRecordVersion: 1,
          toStatus: OrderStatus.Submitted,
          submittedAt: NOW,
          approvedAt: null,
          orderedAt: null,
          receivedAt: null,
          completedAt: null,
          cancelledAt: null,
          now: NOW,
        })
      )?.status,
    ).toBe(OrderStatus.Submitted);
    const stale = scopeReturning([]);
    expect(
      await repository.applyStatusChange(stale.scope, {
        id: 'order-1',
        teamId: 'team-1',
        expectedRecordVersion: 9,
        toStatus: OrderStatus.Submitted,
        submittedAt: NOW,
        approvedAt: null,
        orderedAt: null,
        receivedAt: null,
        completedAt: null,
        cancelledAt: null,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('inserts and lists items, and exports print facts only', async () => {
    const item = scopeReturning([ITEM_ROW]);
    expect(
      (
        await repository.insertItem(item.scope, {
          id: 'item-1',
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
          now: NOW,
        })
      ).size,
    ).toBe(JerseySize.Medium);
    const items = scopeReturning([ITEM_ROW]);
    expect(await repository.listItems(items.scope, 'order-1')).toHaveLength(1);
    const exported = scopeReturning([
      {
        product_name: 'Home',
        kit_type: 'home',
        size: 'm',
        sleeves: 'short',
        printed_name: 'ALI',
        number: 7,
        quantity: 1,
      },
    ]);
    const lines = await repository.supplierExport(exported.scope, 'order-1');
    expect(String(exported.run.mock.calls[0]?.[0])).not.toContain('membership');
    expect(lines[0]?.number).toBe(7);
  });

  it('bounds the order list and count', async () => {
    const filter = { seasonId: null, status: null };
    const list = scopeReturning([ORDER_ROW]);
    expect(
      await repository.listForScope(list.scope, 'team-1', filter, {
        limit: 900,
        offset: 0,
      }),
    ).toHaveLength(1);
    expect(list.run.mock.calls[0]?.[1]).toContain(100);
    const count = scopeReturning([{ count: 5 }]);
    expect(await repository.countForScope(count.scope, 'team-1', filter)).toBe(
      5,
    );
  });
});

describe('JerseyInventoryRepository', () => {
  const repository = new JerseyInventoryRepository();

  it('ensures a variant and moves stock, refusing an over-issue', async () => {
    const ensured = scopeReturning([], [INVENTORY_ROW]);
    expect(
      (
        await repository.ensureVariant(
          ensured.scope,
          'inv-1',
          'team-1',
          'product-1',
          JerseySize.Medium,
          KitType.Home,
          NOW,
        )
      ).onHand,
    ).toBe(10);
    const moved = scopeReturning([{ ...INVENTORY_ROW, on_hand: 9, issued: 1 }]);
    expect(
      (await repository.applyMovement(moved.scope, 'inv-1', -1, 1, 0, NOW))
        ?.onHand,
    ).toBe(9);
    expect(String(moved.run.mock.calls[0]?.[0])).toContain(
      '"on_hand" + $2 >= 0',
    );
    const over = scopeReturning([]);
    expect(
      await repository.applyMovement(over.scope, 'inv-1', -50, 50, 0, NOW),
    ).toBeNull();
  });

  it('appends an issue and lists inventory', async () => {
    const issue = scopeReturning([{ id: 'issue-1' }]);
    expect(
      await repository.insertIssue(issue.scope, {
        id: 'issue-1',
        teamId: 'team-1',
        productId: 'product-1',
        membershipId: 'member-1',
        size: JerseySize.Medium,
        kitType: KitType.Home,
        number: null,
        direction: IssueDirection.Issue,
        quantity: 1,
        issuedBy: 'user-1',
        now: NOW,
      }),
    ).toBe('issue-1');
    const list = scopeReturning([INVENTORY_ROW]);
    expect(
      await repository.listForTeam(list.scope, 'team-1', {
        limit: 20,
        offset: 0,
      }),
    ).toHaveLength(1);
    const count = scopeReturning([{ count: 1 }]);
    expect(await repository.countForTeam(count.scope, 'team-1')).toBe(1);
  });

  it('throws when the ensured variant cannot be read back', async () => {
    const { scope } = scopeReturning([], []);
    await expect(
      repository.ensureVariant(
        scope,
        'inv-1',
        'team-1',
        'product-1',
        JerseySize.Medium,
        KitType.Home,
        NOW,
      ),
    ).rejects.toThrow(/inventory ensure/u);
  });
});
