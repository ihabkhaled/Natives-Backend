/** Raw `jersey_products` row. */
export interface ProductRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly product_key: string;
  readonly name: string;
  readonly kit_type: string;
  readonly supplier: string | null;
  readonly customizable: boolean;
  readonly status: string;
  readonly created_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `number_reservations` row. */
export interface ReservationRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string;
  readonly division: string;
  readonly number: number | string;
  readonly membership_id: string;
  readonly printed_name: string;
  readonly normalized_name: string;
  readonly status: string;
  readonly active_from: string | Date;
  readonly released_at: string | Date | null;
  readonly release_reason: string | null;
  readonly record_version: number | string;
  readonly created_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `jersey_orders` row. */
export interface OrderRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string;
  readonly reference: string;
  readonly supplier: string | null;
  readonly status: string;
  readonly payment_status: string;
  readonly external: boolean;
  readonly notes: string | null;
  readonly record_version: number | string;
  readonly created_by: string | null;
  readonly submitted_at: string | Date | null;
  readonly approved_at: string | Date | null;
  readonly ordered_at: string | Date | null;
  readonly received_at: string | Date | null;
  readonly completed_at: string | Date | null;
  readonly cancelled_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `jersey_order_items` row. */
export interface OrderItemRow {
  readonly id: string;
  readonly team_id: string;
  readonly order_id: string;
  readonly product_id: string;
  readonly membership_id: string | null;
  readonly kit_type: string;
  readonly size: string;
  readonly sleeves: string;
  readonly division: string;
  readonly printed_name: string | null;
  readonly number: number | string | null;
  readonly quantity: number | string;
  readonly created_at: string | Date;
}

/** Raw `jersey_inventory` row. */
export interface InventoryRow {
  readonly id: string;
  readonly team_id: string;
  readonly product_id: string;
  readonly size: string;
  readonly kit_type: string;
  readonly on_hand: number | string;
  readonly issued: number | string;
  readonly returned: number | string;
  readonly record_version: number | string;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** A privacy-minimal supplier export line. No member identity. */
export interface SupplierExportRow {
  readonly product_name: string;
  readonly kit_type: string;
  readonly size: string;
  readonly sleeves: string;
  readonly printed_name: string | null;
  readonly number: number | string | null;
  readonly quantity: number | string;
}

/** A generic count row. */
export interface JerseyCountRow {
  readonly count: number | string;
}

/** A single-column id probe row for existence checks. */
export interface JerseyIdRow {
  readonly id: string;
}
