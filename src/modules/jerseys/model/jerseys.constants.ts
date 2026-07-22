import type { ErrorMessageKey } from '@core/errors/error.types';

// --- API surface -------------------------------------------------------------

export const JERSEYS_API_TAG = 'jerseys';
export const PRODUCTS_ROUTE = 'teams/:teamId/jersey-products';
export const RESERVATIONS_ROUTE = 'teams/:teamId/number-reservations';
export const ORDERS_ROUTE = 'teams/:teamId/jersey-orders';
export const INVENTORY_ROUTE = 'teams/:teamId/jersey-inventory';

export const TEAM_ID_PARAM = 'teamId';
export const PRODUCT_ID_PARAM = 'productId';
export const RESERVATION_ID_PARAM = 'reservationId';
export const ORDER_ID_PARAM = 'orderId';

export const RESERVATION_ITEM_ROUTE = ':reservationId';
export const RESERVATION_RELEASE_ROUTE = ':reservationId/release';
export const ORDER_ITEM_ROUTE = ':orderId';
export const ORDER_ITEMS_ROUTE = ':orderId/items';
export const ORDER_TRANSITION_ROUTE = ':orderId/transition';
export const ORDER_SUPPLIER_EXPORT_ROUTE = ':orderId/supplier-export';
export const INVENTORY_ISSUE_ROUTE = 'issue';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;
export const ORDER_ITEMS_MAX = 200;

// --- Field bounds ------------------------------------------------------------

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 120;
export const KEY_MIN_LENGTH = 2;
export const KEY_MAX_LENGTH = 60;
export const REFERENCE_MIN_LENGTH = 2;
export const REFERENCE_MAX_LENGTH = 120;
export const PRINTED_NAME_MIN_LENGTH = 1;
export const PRINTED_NAME_MAX_LENGTH = 20;
export const SUPPLIER_MAX_LENGTH = 120;
export const NOTES_MAX_LENGTH = 2000;
export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 500;
export const RECORD_VERSION_MIN = 1;
export const NUMBER_MIN = 0;
export const NUMBER_MAX = 999;
export const QUANTITY_MIN = 1;
export const QUANTITY_MAX = 500;
export const STOCK_MIN = 0;
export const STOCK_MAX = 100_000;

/** The printed-name charset the normalizer keeps. */
export const PRINTED_NAME_PATTERN = /^[A-Za-z0-9 .'-]+$/u;

// --- Error messages ----------------------------------------------------------

export const PRODUCT_NOT_FOUND_MESSAGE =
  'The requested jersey product was not found';
export const PRODUCT_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.jerseys.productNotFound';
export const RESERVATION_NOT_FOUND_MESSAGE =
  'The requested number reservation was not found';
export const RESERVATION_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.jerseys.reservationNotFound';
export const ORDER_NOT_FOUND_MESSAGE = 'The requested order was not found';
export const ORDER_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.jerseys.orderNotFound';
export const JERSEY_SCOPE_NOT_FOUND_MESSAGE =
  'The team, season, or member scope was not found';
export const JERSEY_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.jerseys.scopeNotFound';
export const JERSEY_VALIDATION_MESSAGE =
  'The jersey request failed a domain validation rule';
export const JERSEY_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.jerseys.validation';
export const NUMBER_COLLISION_MESSAGE =
  'Another active reservation already holds that number in this scope';
export const NUMBER_COLLISION_MESSAGE_KEY: ErrorMessageKey =
  'errors.jerseys.numberCollision';
export const ORDER_INVALID_TRANSITION_MESSAGE =
  'The order cannot make this lifecycle transition';
export const ORDER_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.jerseys.orderInvalidTransition';
export const ORDER_LOCKED_MESSAGE =
  'The order is no longer a draft and its items cannot be changed';
export const ORDER_LOCKED_MESSAGE_KEY: ErrorMessageKey =
  'errors.jerseys.orderLocked';
export const JERSEY_VERSION_CONFLICT_MESSAGE =
  'The record was modified concurrently';
export const JERSEY_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.jerseys.versionConflict';
export const INSUFFICIENT_STOCK_MESSAGE =
  'There is not enough stock on hand to issue that quantity';
export const INSUFFICIENT_STOCK_MESSAGE_KEY: ErrorMessageKey =
  'errors.jerseys.insufficientStock';

// --- Audit actions / resources ----------------------------------------------

export const PRODUCT_RESOURCE_TYPE = 'jersey_product';
export const RESERVATION_RESOURCE_TYPE = 'number_reservation';
export const ORDER_RESOURCE_TYPE = 'jersey_order';
export const INVENTORY_RESOURCE_TYPE = 'jersey_inventory';

export const PRODUCT_CREATED_ACTION = 'jersey.product.created';
export const RESERVATION_CREATED_ACTION = 'jersey.reservation.created';
export const RESERVATION_RELEASED_ACTION = 'jersey.reservation.released';
export const ORDER_CREATED_ACTION = 'jersey.order.created';
export const ORDER_ITEM_ADDED_ACTION = 'jersey.order.item_added';
export const ORDER_TRANSITIONED_ACTION = 'jersey.order.transitioned';
export const INVENTORY_ISSUED_ACTION = 'jersey.inventory.issued';

// --- Domain events -----------------------------------------------------------

export const JERSEYS_EVENT_VERSION = 1;
export const ORDER_COMPLETED_EVENT = 'jersey.order.completed.v1';

// --- Static column lists (never SELECT *) ------------------------------------

export const PRODUCT_COLUMNS = `"id", "team_id", "season_id", "product_key",
  "name", "kit_type", "supplier", "customizable", "status", "created_by",
  "created_at", "updated_at"`;

export const RESERVATION_COLUMNS = `"id", "team_id", "season_id", "division",
  "number", "membership_id", "printed_name", "normalized_name", "status",
  "active_from", "released_at", "release_reason", "record_version",
  "created_by", "created_at", "updated_at"`;

export const ORDER_COLUMNS = `"id", "team_id", "season_id", "reference",
  "supplier", "status", "payment_status", "external", "notes",
  "record_version", "created_by", "submitted_at", "approved_at", "ordered_at",
  "received_at", "completed_at", "cancelled_at", "created_at", "updated_at"`;

export const ORDER_ITEM_COLUMNS = `"id", "team_id", "order_id", "product_id",
  "membership_id", "kit_type", "size", "sleeves", "division", "printed_name",
  "number", "quantity", "created_at"`;

export const INVENTORY_COLUMNS = `"id", "team_id", "product_id", "size",
  "kit_type", "on_hand", "issued", "returned", "record_version", "created_at",
  "updated_at"`;

/** The order statuses in which items may still be edited (draft only). */
export const EDITABLE_ORDER_STATUS = 'draft';
