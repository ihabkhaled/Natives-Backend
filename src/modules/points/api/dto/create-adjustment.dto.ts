import { ApiProperty } from '@core/openapi';
import {
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from '@core/validation';

import {
  ADJUSTMENT_AMOUNT_MAX,
  ADJUSTMENT_AMOUNT_MIN,
  ADJUSTMENT_REASON_MAX_LENGTH,
  ADJUSTMENT_REASON_MIN_LENGTH,
  OPERATION_KEY_MAX_LENGTH,
  OPERATION_KEY_MIN_LENGTH,
} from '../../model/points.constants';

/**
 * Request body for a manual points adjustment. The signed amount may credit or
 * debit; the reason is mandatory (audited); the operation key makes the write
 * idempotent so a retry never double-adjusts.
 */
export class CreateAdjustmentDto {
  @ApiProperty({
    minimum: ADJUSTMENT_AMOUNT_MIN,
    maximum: ADJUSTMENT_AMOUNT_MAX,
  })
  @IsNumber()
  @Min(ADJUSTMENT_AMOUNT_MIN)
  @Max(ADJUSTMENT_AMOUNT_MAX)
  declare readonly amount: number;

  @ApiProperty({
    minLength: ADJUSTMENT_REASON_MIN_LENGTH,
    maxLength: ADJUSTMENT_REASON_MAX_LENGTH,
  })
  @IsString()
  @MinLength(ADJUSTMENT_REASON_MIN_LENGTH)
  @MaxLength(ADJUSTMENT_REASON_MAX_LENGTH)
  declare readonly reason: string;

  @ApiProperty({
    minLength: OPERATION_KEY_MIN_LENGTH,
    maxLength: OPERATION_KEY_MAX_LENGTH,
  })
  @IsString()
  @MinLength(OPERATION_KEY_MIN_LENGTH)
  @MaxLength(OPERATION_KEY_MAX_LENGTH)
  declare readonly operationKey: string;
}
