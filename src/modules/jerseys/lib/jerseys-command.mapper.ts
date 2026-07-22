import {
  IssueDirection,
  JerseyDivision,
  KitType,
  PaymentStatus,
  SleeveType,
} from '../model/jerseys.enums';
import type {
  IssueContent,
  IssueContentInput,
  OrderContent,
  OrderContentInput,
  OrderItemContent,
  OrderItemContentInput,
  OrderListFilter,
  OrderListFilterInput,
  ProductContent,
  ProductContentInput,
  ReservationContent,
  ReservationContentInput,
  ReservationListFilter,
  ReservationListFilterInput,
} from '../model/jerseys.types';

export function toProductContent(input: ProductContentInput): ProductContent {
  return {
    seasonId: input.seasonId ?? null,
    productKey: input.productKey.trim(),
    name: input.name.trim(),
    kitType: input.kitType ?? KitType.Home,
    supplier: input.supplier ?? null,
    customizable: input.customizable ?? true,
  };
}

export function toReservationContent(
  input: ReservationContentInput,
): ReservationContent {
  return {
    seasonId: input.seasonId,
    division: input.division ?? JerseyDivision.Open,
    number: input.number,
    membershipId: input.membershipId,
    printedName: input.printedName.trim(),
  };
}

export function toOrderContent(input: OrderContentInput): OrderContent {
  return {
    seasonId: input.seasonId,
    reference: input.reference.trim(),
    supplier: input.supplier ?? null,
    paymentStatus: input.paymentStatus ?? PaymentStatus.Unset,
    external: input.external ?? false,
    notes: input.notes ?? null,
  };
}

export function toOrderItemContent(
  input: OrderItemContentInput,
): OrderItemContent {
  return {
    productId: input.productId,
    membershipId: input.membershipId ?? null,
    kitType: input.kitType ?? KitType.Home,
    size: input.size,
    sleeves: input.sleeves ?? SleeveType.Short,
    division: input.division ?? JerseyDivision.Open,
    printedName:
      input.printedName === undefined || input.printedName === null
        ? null
        : input.printedName.trim(),
    number: input.number ?? null,
    quantity: input.quantity ?? 1,
  };
}

export function toIssueContent(input: IssueContentInput): IssueContent {
  return {
    productId: input.productId,
    membershipId: input.membershipId,
    size: input.size,
    kitType: input.kitType ?? KitType.Home,
    number: input.number ?? null,
    direction: input.direction ?? IssueDirection.Issue,
    quantity: input.quantity ?? 1,
  };
}

export function toReservationListFilter(
  input: ReservationListFilterInput,
): ReservationListFilter {
  return {
    seasonId: input.seasonId ?? null,
    division: input.division ?? null,
    status: input.status ?? null,
    membershipId: input.membershipId ?? null,
  };
}

export function toOrderListFilter(
  input: OrderListFilterInput,
): OrderListFilter {
  return {
    seasonId: input.seasonId ?? null,
    status: input.status ?? null,
  };
}
