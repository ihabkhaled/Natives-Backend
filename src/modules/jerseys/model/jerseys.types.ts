import type {
  ApparelValidationCode,
  IssueDirection,
  JerseyDivision,
  JerseySize,
  KitType,
  OrderStatus,
  OrderTransition,
  PaymentStatus,
  ProductStatus,
  ReservationStatus,
  SleeveType,
} from './jerseys.enums';

// --- Pagination --------------------------------------------------------------

export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface PagedResult<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

// --- Products ----------------------------------------------------------------

export interface JerseyProduct {
  readonly productId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly productKey: string;
  readonly name: string;
  readonly kitType: KitType;
  readonly supplier: string | null;
  readonly customizable: boolean;
  readonly status: ProductStatus;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewJerseyProduct {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly productKey: string;
  readonly name: string;
  readonly kitType: KitType;
  readonly supplier: string | null;
  readonly customizable: boolean;
  readonly createdBy: string;
  readonly now: Date;
}

export interface ProductContent {
  readonly seasonId: string | null;
  readonly productKey: string;
  readonly name: string;
  readonly kitType: KitType;
  readonly supplier: string | null;
  readonly customizable: boolean;
}

export interface ProductContentInput {
  readonly seasonId?: string | null;
  readonly productKey: string;
  readonly name: string;
  readonly kitType?: KitType | null;
  readonly supplier?: string | null;
  readonly customizable?: boolean | null;
}

export interface CreateProductCommand {
  readonly content: ProductContent;
}

export type JerseyProductPage = PagedResult<JerseyProduct>;

// --- Reservations ------------------------------------------------------------

export interface NumberReservation {
  readonly reservationId: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly division: JerseyDivision;
  readonly number: number;
  readonly membershipId: string;
  readonly printedName: string;
  readonly normalizedName: string;
  readonly status: ReservationStatus;
  readonly activeFrom: Date;
  readonly releasedAt: Date | null;
  readonly releaseReason: string | null;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewNumberReservation {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly division: JerseyDivision;
  readonly number: number;
  readonly membershipId: string;
  readonly printedName: string;
  readonly normalizedName: string;
  readonly createdBy: string;
  readonly now: Date;
}

export interface ReservationContent {
  readonly seasonId: string;
  readonly division: JerseyDivision;
  readonly number: number;
  readonly membershipId: string;
  readonly printedName: string;
}

export interface ReservationContentInput {
  readonly seasonId: string;
  readonly division?: JerseyDivision | null;
  readonly number: number;
  readonly membershipId: string;
  readonly printedName: string;
}

export interface CreateReservationCommand {
  readonly content: ReservationContent;
}

export interface ReleaseReservationCommand {
  readonly reason: string;
  readonly expectedRecordVersion: number;
}

export type NumberReservationPage = PagedResult<NumberReservation>;

export interface ReservationListFilter {
  readonly seasonId: string | null;
  readonly division: JerseyDivision | null;
  readonly status: ReservationStatus | null;
  readonly membershipId: string | null;
}

export interface ReservationListFilterInput {
  readonly seasonId?: string | null;
  readonly division?: JerseyDivision | null;
  readonly status?: ReservationStatus | null;
  readonly membershipId?: string | null;
}

// --- Orders ------------------------------------------------------------------

export interface JerseyOrder {
  readonly orderId: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly reference: string;
  readonly supplier: string | null;
  readonly status: OrderStatus;
  readonly paymentStatus: PaymentStatus;
  readonly external: boolean;
  readonly notes: string | null;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly submittedAt: Date | null;
  readonly approvedAt: Date | null;
  readonly orderedAt: Date | null;
  readonly receivedAt: Date | null;
  readonly completedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewJerseyOrder {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly reference: string;
  readonly supplier: string | null;
  readonly paymentStatus: PaymentStatus;
  readonly external: boolean;
  readonly notes: string | null;
  readonly createdBy: string;
  readonly now: Date;
}

export interface OrderContent {
  readonly seasonId: string;
  readonly reference: string;
  readonly supplier: string | null;
  readonly paymentStatus: PaymentStatus;
  readonly external: boolean;
  readonly notes: string | null;
}

export interface OrderContentInput {
  readonly seasonId: string;
  readonly reference: string;
  readonly supplier?: string | null;
  readonly paymentStatus?: PaymentStatus | null;
  readonly external?: boolean | null;
  readonly notes?: string | null;
}

export interface CreateOrderCommand {
  readonly content: OrderContent;
}

export interface OrderTransitionCommand {
  readonly transition: OrderTransition;
  readonly expectedRecordVersion: number;
}

export interface OrderStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: OrderStatus;
  readonly submittedAt: Date | null;
  readonly approvedAt: Date | null;
  readonly orderedAt: Date | null;
  readonly receivedAt: Date | null;
  readonly completedAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly now: Date;
}

export interface OrderItem {
  readonly itemId: string;
  readonly teamId: string;
  readonly orderId: string;
  readonly productId: string;
  readonly membershipId: string | null;
  readonly kitType: KitType;
  readonly size: JerseySize;
  readonly sleeves: SleeveType;
  readonly division: JerseyDivision;
  readonly printedName: string | null;
  readonly number: number | null;
  readonly quantity: number;
  readonly createdAt: Date;
}

export interface NewOrderItem {
  readonly id: string;
  readonly teamId: string;
  readonly orderId: string;
  readonly productId: string;
  readonly membershipId: string | null;
  readonly kitType: KitType;
  readonly size: JerseySize;
  readonly sleeves: SleeveType;
  readonly division: JerseyDivision;
  readonly printedName: string | null;
  readonly number: number | null;
  readonly quantity: number;
  readonly now: Date;
}

export interface OrderItemContent {
  readonly productId: string;
  readonly membershipId: string | null;
  readonly kitType: KitType;
  readonly size: JerseySize;
  readonly sleeves: SleeveType;
  readonly division: JerseyDivision;
  readonly printedName: string | null;
  readonly number: number | null;
  readonly quantity: number;
}

export interface OrderItemContentInput {
  readonly productId: string;
  readonly membershipId?: string | null;
  readonly kitType?: KitType | null;
  readonly size: JerseySize;
  readonly sleeves?: SleeveType | null;
  readonly division?: JerseyDivision | null;
  readonly printedName?: string | null;
  readonly number?: number | null;
  readonly quantity?: number | null;
}

export interface AddOrderItemCommand {
  readonly content: OrderItemContent;
}

export type JerseyOrderPage = PagedResult<JerseyOrder>;

/** An order's line items (already bounded by the repository). */
export interface OrderItemList {
  readonly items: readonly OrderItem[];
}

export interface OrderListFilter {
  readonly seasonId: string | null;
  readonly status: OrderStatus | null;
}

export interface OrderListFilterInput {
  readonly seasonId?: string | null;
  readonly status?: OrderStatus | null;
}

/** One privacy-minimal supplier export line. Number and printed name only. */
export interface SupplierExportLine {
  readonly productName: string;
  readonly kitType: KitType;
  readonly size: JerseySize;
  readonly sleeves: SleeveType;
  readonly printedName: string | null;
  readonly number: number | null;
  readonly quantity: number;
}

/** A privacy-minimal supplier export. No member identity, no finance data. */
export interface SupplierExport {
  readonly orderId: string;
  readonly reference: string;
  readonly lines: readonly SupplierExportLine[];
}

// --- Inventory / issues ------------------------------------------------------

export interface JerseyInventory {
  readonly inventoryId: string;
  readonly teamId: string;
  readonly productId: string;
  readonly size: JerseySize;
  readonly kitType: KitType;
  readonly onHand: number;
  readonly issued: number;
  readonly returned: number;
  readonly recordVersion: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface IssueContent {
  readonly productId: string;
  readonly membershipId: string;
  readonly size: JerseySize;
  readonly kitType: KitType;
  readonly number: number | null;
  readonly direction: IssueDirection;
  readonly quantity: number;
}

export interface IssueContentInput {
  readonly productId: string;
  readonly membershipId: string;
  readonly size: JerseySize;
  readonly kitType?: KitType | null;
  readonly number?: number | null;
  readonly direction?: IssueDirection | null;
  readonly quantity?: number | null;
}

export interface IssueStockCommand {
  readonly content: IssueContent;
}

export interface NewJerseyIssue {
  readonly id: string;
  readonly teamId: string;
  readonly productId: string;
  readonly membershipId: string;
  readonly size: JerseySize;
  readonly kitType: KitType;
  readonly number: number | null;
  readonly direction: IssueDirection;
  readonly quantity: number;
  readonly issuedBy: string;
  readonly now: Date;
}

export type JerseyInventoryPage = PagedResult<JerseyInventory>;

// --- Validation --------------------------------------------------------------

/** One explainable apparel validation outcome. */
export interface ApparelViolation {
  readonly code: ApparelValidationCode;
}

/** The full validation verdict of an order item or reservation. */
export interface ApparelVerdict {
  readonly valid: boolean;
  readonly violations: readonly ApparelViolation[];
}

/** The gender/division facts the division rule consumes. */
export interface DivisionCheckInput {
  readonly productDivision: JerseyDivision;
  readonly requestedDivision: JerseyDivision;
}

/** The resolved team/season scope of a jersey operation. */
export interface JerseyScope {
  readonly teamId: string;
  readonly seasonId: string;
}
