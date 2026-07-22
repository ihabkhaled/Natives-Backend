/**
 * Enumerations for jerseys, apparel orders, number reservations, inventory, and
 * fulfillment (UN-604). Every enum ships a `*_VALUES` tuple so mappers can
 * validate a raw database string against the closed set.
 */

export enum KitType {
  Home = 'home',
  Away = 'away',
  Alternate = 'alternate',
  Training = 'training',
}

export const KIT_TYPE_VALUES: readonly KitType[] = Object.values(KitType);

export enum JerseySize {
  ExtraSmall = 'xs',
  Small = 's',
  Medium = 'm',
  Large = 'l',
  ExtraLarge = 'xl',
  DoubleExtraLarge = 'xxl',
  TripleExtraLarge = 'xxxl',
}

export const JERSEY_SIZE_VALUES: readonly JerseySize[] =
  Object.values(JerseySize);

export enum SleeveType {
  Short = 'short',
  Long = 'long',
  Sleeveless = 'sleeveless',
}

export const SLEEVE_TYPE_VALUES: readonly SleeveType[] =
  Object.values(SleeveType);

export enum JerseyDivision {
  Open = 'open',
  Women = 'women',
  Mixed = 'mixed',
}

export const JERSEY_DIVISION_VALUES: readonly JerseyDivision[] =
  Object.values(JerseyDivision);

export enum ProductStatus {
  Active = 'active',
  Archived = 'archived',
}

export const PRODUCT_STATUS_VALUES: readonly ProductStatus[] =
  Object.values(ProductStatus);

export enum ReservationStatus {
  Active = 'active',
  Released = 'released',
}

export const RESERVATION_STATUS_VALUES: readonly ReservationStatus[] =
  Object.values(ReservationStatus);

/** Lifecycle of an order batch. */
export enum OrderStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  Approved = 'approved',
  Ordered = 'ordered',
  Received = 'received',
  Issued = 'issued',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export const ORDER_STATUS_VALUES: readonly OrderStatus[] =
  Object.values(OrderStatus);

/** The verbs the order transition endpoint accepts. */
export enum OrderTransition {
  Submit = 'submit',
  Approve = 'approve',
  Order = 'order',
  Receive = 'receive',
  Issue = 'issue',
  Complete = 'complete',
  Cancel = 'cancel',
}

export const ORDER_TRANSITION_VALUES: readonly OrderTransition[] =
  Object.values(OrderTransition);

/**
 * Minimal payment status. Deliberately coarse: the application NEVER stores card
 * data — this only records whether a batch has been paid, not how.
 */
export enum PaymentStatus {
  Unset = 'unset',
  Pending = 'pending',
  Partial = 'partial',
  Paid = 'paid',
  Waived = 'waived',
}

export const PAYMENT_STATUS_VALUES: readonly PaymentStatus[] =
  Object.values(PaymentStatus);

/** Whether stock moved out to a member or came back. */
export enum IssueDirection {
  Issue = 'issue',
  Return = 'return',
}

export const ISSUE_DIRECTION_VALUES: readonly IssueDirection[] =
  Object.values(IssueDirection);

/** Why an apparel validation rule rejected a request. */
export enum ApparelValidationCode {
  MissingSize = 'missing_size',
  InvalidNumber = 'invalid_number',
  MissingPrintedName = 'missing_printed_name',
  DivisionMismatch = 'division_mismatch',
  QuantityOutOfRange = 'quantity_out_of_range',
}

export const APPAREL_VALIDATION_CODE_VALUES: readonly ApparelValidationCode[] =
  Object.values(ApparelValidationCode);
