import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Type,
} from '@core/validation';

import {
  KEY_MAX_LENGTH,
  KEY_MIN_LENGTH,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  LIST_MIN_LIMIT,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  NOTES_MAX_LENGTH,
  NUMBER_MAX,
  NUMBER_MIN,
  PRINTED_NAME_MAX_LENGTH,
  PRINTED_NAME_MIN_LENGTH,
  QUANTITY_MAX,
  QUANTITY_MIN,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  RECORD_VERSION_MIN,
  REFERENCE_MAX_LENGTH,
  REFERENCE_MIN_LENGTH,
  SUPPLIER_MAX_LENGTH,
} from '../../model/jerseys.constants';
import {
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
} from '../../model/jerseys.enums';

/**
 * The API boundary of jerseys (UN-604). Every DTO class name is module-qualified
 * (`Jersey*` / `Reservation*` / `Order*`) so the generated OpenAPI document can
 * never collapse two shapes into one schema name. No payment card fields exist
 * anywhere in this surface — only a coarse payment status.
 */

export class JerseyPageQueryDto {
  @ApiPropertyOptional({
    minimum: LIST_MIN_LIMIT,
    maximum: LIST_MAX_LIMIT,
    default: LIST_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(LIST_MIN_LIMIT)
  @Max(LIST_MAX_LIMIT)
  readonly limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly offset?: number;
}

export class ReservationListQueryDto extends JerseyPageQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string;

  @ApiPropertyOptional({ enum: JerseyDivision })
  @IsOptional()
  @IsEnum(JerseyDivision)
  readonly division?: JerseyDivision;

  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  readonly status?: ReservationStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly membershipId?: string;
}

export class OrderListQueryDto extends JerseyPageQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  readonly status?: OrderStatus;
}

// --- Products ----------------------------------------------------------------

export class CreateJerseyProductDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string | null;

  @ApiProperty({ minLength: KEY_MIN_LENGTH, maxLength: KEY_MAX_LENGTH })
  @IsString()
  @MinLength(KEY_MIN_LENGTH)
  @MaxLength(KEY_MAX_LENGTH)
  declare readonly productKey: string;

  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiPropertyOptional({ enum: KitType })
  @IsOptional()
  @IsEnum(KitType)
  readonly kitType?: KitType;

  @ApiPropertyOptional({ maxLength: SUPPLIER_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(SUPPLIER_MAX_LENGTH)
  readonly supplier?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  readonly customizable?: boolean;
}

export class JerseyProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly productId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty()
  declare readonly productKey: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ enum: KitType })
  declare readonly kitType: KitType;

  @ApiProperty({ type: String, nullable: true })
  declare readonly supplier: string | null;

  @ApiProperty()
  declare readonly customizable: boolean;

  @ApiProperty({ enum: ProductStatus })
  declare readonly status: ProductStatus;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

export class ListJerseyProductsResponseDto {
  @ApiProperty({ type: [JerseyProductResponseDto] })
  declare readonly items: readonly JerseyProductResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}

// --- Reservations ------------------------------------------------------------

export class CreateReservationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly seasonId: string;

  @ApiPropertyOptional({ enum: JerseyDivision })
  @IsOptional()
  @IsEnum(JerseyDivision)
  readonly division?: JerseyDivision;

  @ApiProperty({ minimum: NUMBER_MIN, maximum: NUMBER_MAX })
  @IsInt()
  @Min(NUMBER_MIN)
  @Max(NUMBER_MAX)
  declare readonly number: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly membershipId: string;

  @ApiProperty({
    minLength: PRINTED_NAME_MIN_LENGTH,
    maxLength: PRINTED_NAME_MAX_LENGTH,
  })
  @IsString()
  @MinLength(PRINTED_NAME_MIN_LENGTH)
  @MaxLength(PRINTED_NAME_MAX_LENGTH)
  declare readonly printedName: string;
}

export class ReleaseReservationDto {
  @ApiProperty({ minLength: REASON_MIN_LENGTH, maxLength: REASON_MAX_LENGTH })
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  declare readonly reason: string;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}

export class NumberReservationResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly reservationId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly seasonId: string;

  @ApiProperty({ enum: JerseyDivision })
  declare readonly division: JerseyDivision;

  @ApiProperty()
  declare readonly number: number;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty()
  declare readonly printedName: string;

  @ApiProperty({ enum: ReservationStatus })
  declare readonly status: ReservationStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly activeFrom: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly releasedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly releaseReason: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

export class ListNumberReservationsResponseDto {
  @ApiProperty({ type: [NumberReservationResponseDto] })
  declare readonly items: readonly NumberReservationResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}

// --- Orders ------------------------------------------------------------------

export class CreateJerseyOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly seasonId: string;

  @ApiProperty({
    minLength: REFERENCE_MIN_LENGTH,
    maxLength: REFERENCE_MAX_LENGTH,
  })
  @IsString()
  @MinLength(REFERENCE_MIN_LENGTH)
  @MaxLength(REFERENCE_MAX_LENGTH)
  declare readonly reference: string;

  @ApiPropertyOptional({ maxLength: SUPPLIER_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(SUPPLIER_MAX_LENGTH)
  readonly supplier?: string | null;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  readonly paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  readonly external?: boolean;

  @ApiPropertyOptional({ maxLength: NOTES_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NOTES_MAX_LENGTH)
  readonly notes?: string | null;
}

export class AddOrderItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly productId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly membershipId?: string | null;

  @ApiPropertyOptional({ enum: KitType })
  @IsOptional()
  @IsEnum(KitType)
  readonly kitType?: KitType;

  @ApiProperty({ enum: JerseySize })
  @IsEnum(JerseySize)
  declare readonly size: JerseySize;

  @ApiPropertyOptional({ enum: SleeveType })
  @IsOptional()
  @IsEnum(SleeveType)
  readonly sleeves?: SleeveType;

  @ApiPropertyOptional({ enum: JerseyDivision })
  @IsOptional()
  @IsEnum(JerseyDivision)
  readonly division?: JerseyDivision;

  @ApiPropertyOptional({
    minLength: PRINTED_NAME_MIN_LENGTH,
    maxLength: PRINTED_NAME_MAX_LENGTH,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(PRINTED_NAME_MAX_LENGTH)
  readonly printedName?: string | null;

  @ApiPropertyOptional({
    minimum: NUMBER_MIN,
    maximum: NUMBER_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(NUMBER_MIN)
  @Max(NUMBER_MAX)
  readonly number?: number | null;

  @ApiPropertyOptional({ minimum: QUANTITY_MIN, maximum: QUANTITY_MAX })
  @IsOptional()
  @IsInt()
  @Min(QUANTITY_MIN)
  @Max(QUANTITY_MAX)
  readonly quantity?: number;
}

export class TransitionJerseyOrderDto {
  @ApiProperty({ enum: OrderTransition })
  @IsEnum(OrderTransition)
  declare readonly transition: OrderTransition;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}

export class JerseyOrderResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly orderId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly seasonId: string;

  @ApiProperty()
  declare readonly reference: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly supplier: string | null;

  @ApiProperty({ enum: OrderStatus })
  declare readonly status: OrderStatus;

  @ApiProperty({ enum: PaymentStatus })
  declare readonly paymentStatus: PaymentStatus;

  @ApiProperty()
  declare readonly external: boolean;

  @ApiProperty({ type: String, nullable: true })
  declare readonly notes: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly completedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

export class ListJerseyOrdersResponseDto {
  @ApiProperty({ type: [JerseyOrderResponseDto] })
  declare readonly items: readonly JerseyOrderResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}

export class JerseyOrderItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly itemId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly orderId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly productId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly membershipId: string | null;

  @ApiProperty({ enum: KitType })
  declare readonly kitType: KitType;

  @ApiProperty({ enum: JerseySize })
  declare readonly size: JerseySize;

  @ApiProperty({ enum: SleeveType })
  declare readonly sleeves: SleeveType;

  @ApiProperty({ enum: JerseyDivision })
  declare readonly division: JerseyDivision;

  @ApiProperty({ type: String, nullable: true })
  declare readonly printedName: string | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly number: number | null;

  @ApiProperty()
  declare readonly quantity: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;
}

export class ListJerseyOrderItemsResponseDto {
  @ApiProperty({ type: [JerseyOrderItemResponseDto] })
  declare readonly items: readonly JerseyOrderItemResponseDto[];
}

export class SupplierExportLineDto {
  @ApiProperty()
  declare readonly productName: string;

  @ApiProperty({ enum: KitType })
  declare readonly kitType: KitType;

  @ApiProperty({ enum: JerseySize })
  declare readonly size: JerseySize;

  @ApiProperty({ enum: SleeveType })
  declare readonly sleeves: SleeveType;

  @ApiProperty({ type: String, nullable: true })
  declare readonly printedName: string | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly number: number | null;

  @ApiProperty()
  declare readonly quantity: number;
}

export class SupplierExportResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly orderId: string;

  @ApiProperty()
  declare readonly reference: string;

  @ApiProperty({ type: [SupplierExportLineDto] })
  declare readonly lines: readonly SupplierExportLineDto[];
}

// --- Inventory ---------------------------------------------------------------

export class IssueStockDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly productId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly membershipId: string;

  @ApiProperty({ enum: JerseySize })
  @IsEnum(JerseySize)
  declare readonly size: JerseySize;

  @ApiPropertyOptional({ enum: KitType })
  @IsOptional()
  @IsEnum(KitType)
  readonly kitType?: KitType;

  @ApiPropertyOptional({
    minimum: NUMBER_MIN,
    maximum: NUMBER_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(NUMBER_MIN)
  @Max(NUMBER_MAX)
  readonly number?: number | null;

  @ApiPropertyOptional({ enum: IssueDirection })
  @IsOptional()
  @IsEnum(IssueDirection)
  readonly direction?: IssueDirection;

  @ApiPropertyOptional({ minimum: QUANTITY_MIN, maximum: QUANTITY_MAX })
  @IsOptional()
  @IsInt()
  @Min(QUANTITY_MIN)
  @Max(QUANTITY_MAX)
  readonly quantity?: number;
}

export class JerseyInventoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly inventoryId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly productId: string;

  @ApiProperty({ enum: JerseySize })
  declare readonly size: JerseySize;

  @ApiProperty({ enum: KitType })
  declare readonly kitType: KitType;

  @ApiProperty()
  declare readonly onHand: number;

  @ApiProperty()
  declare readonly issued: number;

  @ApiProperty()
  declare readonly returned: number;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

export class ListJerseyInventoryResponseDto {
  @ApiProperty({ type: [JerseyInventoryResponseDto] })
  declare readonly items: readonly JerseyInventoryResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
