import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Jerseys, apparel orders, number reservations, inventory, and fulfillment
 * (UN-604). Six additive tables; it changes no existing table and grants no new
 * permission (jersey.read / jersey.manage are already seeded):
 *
 *   - jersey_products         a catalogue product (home/away kit, training top)
 *                             with configurable variants encoded per order item.
 *   - number_reservations     a scoped reservation/assignment of a shirt NUMBER
 *                             with its printed name, an active period, the owner,
 *                             and a release — history persists, so a released
 *                             number's past owner is always recoverable.
 *   - jersey_orders           an order batch with a lifecycle, a supplier, a
 *                             minimal payment status (no card data ever), and an
 *                             optional external-order privacy flag.
 *   - jersey_order_items      one line: product, home/away, size, sleeves,
 *                             gender/division, printed name, number, quantity.
 *   - jersey_inventory        stock counts per product/variant with issued and
 *                             returned tallies.
 *   - jersey_issues           a record that a specific member was ISSUED (or
 *                             returned) physical stock — distinct from a profile
 *                             preference and a confirmed order.
 *
 * Conventions: UUID PKs, timestamptz UTC, snake_case, check constraints
 * mirroring the enums, optimistic record_version, bounded indexes. Reversible.
 */
export class JerseysSchema1724300000000 implements MigrationInterface {
  name = 'JerseysSchema1724300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createProducts(queryRunner);
    await this.createReservations(queryRunner);
    await this.createOrders(queryRunner);
    await this.createOrderItems(queryRunner);
    await this.createInventory(queryRunner);
    await this.createIssues(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "jersey_issues"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "jersey_inventory"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "jersey_order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "jersey_orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "number_reservations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "jersey_products"`);
  }

  private async createProducts(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "jersey_products" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "product_key" text NOT NULL,
        "name" text NOT NULL,
        "kit_type" text NOT NULL DEFAULT 'home',
        "supplier" text,
        "customizable" boolean NOT NULL DEFAULT true,
        "status" text NOT NULL DEFAULT 'active',
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_product_kit_type" CHECK ("kit_type" IN
          ('home', 'away', 'alternate', 'training')),
        CONSTRAINT "ck_product_status" CHECK ("status" IN
          ('active', 'archived'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_products_team_key"
         ON "jersey_products" ("team_id", "product_key")`,
    );
  }

  private async createReservations(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "number_reservations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid NOT NULL REFERENCES "seasons" ("id") ON DELETE CASCADE,
        "division" text NOT NULL DEFAULT 'open',
        "number" integer NOT NULL,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "printed_name" text NOT NULL,
        "normalized_name" text NOT NULL,
        "status" text NOT NULL DEFAULT 'active',
        "active_from" timestamptz NOT NULL DEFAULT now(),
        "released_at" timestamptz,
        "release_reason" text,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_reservation_division" CHECK ("division" IN
          ('open', 'women', 'mixed')),
        CONSTRAINT "ck_reservation_status" CHECK ("status" IN
          ('active', 'released')),
        CONSTRAINT "ck_reservation_number" CHECK
          ("number" >= 0 AND "number" <= 999)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_reservations_active_number"
         ON "number_reservations" ("team_id", "season_id", "division", "number")
         WHERE "status" = 'active'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_reservations_history"
         ON "number_reservations" ("team_id", "season_id", "number",
           "active_from" DESC)`,
    );
  }

  private async createOrders(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "jersey_orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid NOT NULL REFERENCES "seasons" ("id") ON DELETE CASCADE,
        "reference" text NOT NULL,
        "supplier" text,
        "status" text NOT NULL DEFAULT 'draft',
        "payment_status" text NOT NULL DEFAULT 'unset',
        "external" boolean NOT NULL DEFAULT false,
        "notes" text,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "submitted_at" timestamptz,
        "approved_at" timestamptz,
        "ordered_at" timestamptz,
        "received_at" timestamptz,
        "completed_at" timestamptz,
        "cancelled_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_order_status" CHECK ("status" IN
          ('draft', 'submitted', 'approved', 'ordered', 'received', 'issued',
           'completed', 'cancelled')),
        CONSTRAINT "ck_order_payment" CHECK ("payment_status" IN
          ('unset', 'pending', 'partial', 'paid', 'waived'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_orders_team_reference"
         ON "jersey_orders" ("team_id", "reference")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_orders_scope"
         ON "jersey_orders" ("team_id", "status", "created_at" DESC, "id")`,
    );
  }

  private async createOrderItems(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "jersey_order_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "order_id" uuid NOT NULL REFERENCES "jersey_orders" ("id")
          ON DELETE CASCADE,
        "product_id" uuid NOT NULL REFERENCES "jersey_products" ("id")
          ON DELETE RESTRICT,
        "membership_id" uuid REFERENCES "memberships" ("id") ON DELETE SET NULL,
        "kit_type" text NOT NULL DEFAULT 'home',
        "size" text NOT NULL,
        "sleeves" text NOT NULL DEFAULT 'short',
        "division" text NOT NULL DEFAULT 'open',
        "printed_name" text,
        "number" integer,
        "quantity" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_item_kit_type" CHECK ("kit_type" IN
          ('home', 'away', 'alternate', 'training')),
        CONSTRAINT "ck_item_size" CHECK ("size" IN
          ('xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl')),
        CONSTRAINT "ck_item_sleeves" CHECK ("sleeves" IN
          ('short', 'long', 'sleeveless')),
        CONSTRAINT "ck_item_division" CHECK ("division" IN
          ('open', 'women', 'mixed')),
        CONSTRAINT "ck_item_number" CHECK
          ("number" IS NULL OR ("number" >= 0 AND "number" <= 999)),
        CONSTRAINT "ck_item_quantity" CHECK ("quantity" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_order_items_order"
         ON "jersey_order_items" ("order_id", "id")`,
    );
  }

  private async createInventory(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "jersey_inventory" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "product_id" uuid NOT NULL REFERENCES "jersey_products" ("id")
          ON DELETE CASCADE,
        "size" text NOT NULL,
        "kit_type" text NOT NULL DEFAULT 'home',
        "on_hand" integer NOT NULL DEFAULT 0,
        "issued" integer NOT NULL DEFAULT 0,
        "returned" integer NOT NULL DEFAULT 0,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_inventory_size" CHECK ("size" IN
          ('xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl')),
        CONSTRAINT "ck_inventory_kit_type" CHECK ("kit_type" IN
          ('home', 'away', 'alternate', 'training')),
        CONSTRAINT "ck_inventory_counts" CHECK
          ("on_hand" >= 0 AND "issued" >= 0 AND "returned" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_inventory_variant"
         ON "jersey_inventory" ("team_id", "product_id", "size", "kit_type")`,
    );
  }

  private async createIssues(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "jersey_issues" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "product_id" uuid NOT NULL REFERENCES "jersey_products" ("id")
          ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "size" text NOT NULL,
        "kit_type" text NOT NULL DEFAULT 'home',
        "number" integer,
        "direction" text NOT NULL DEFAULT 'issue',
        "quantity" integer NOT NULL DEFAULT 1,
        "issued_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "issued_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_issue_size" CHECK ("size" IN
          ('xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl')),
        CONSTRAINT "ck_issue_direction" CHECK ("direction" IN
          ('issue', 'return')),
        CONSTRAINT "ck_issue_quantity" CHECK ("quantity" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_issues_member"
         ON "jersey_issues" ("team_id", "membership_id", "issued_at" DESC)`,
    );
  }
}
