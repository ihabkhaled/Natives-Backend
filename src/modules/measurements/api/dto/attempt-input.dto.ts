import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from '@core/validation';

import {
  ATTEMPT_NOTE_MAX_LENGTH,
  ATTEMPT_VALUE_MAX,
  ATTEMPT_VALUE_MIN,
  DQ_REASON_MAX_LENGTH,
} from '../../model/measurements.constants';
import { MeasurementUnit } from '../../model/measurements.enums';

/**
 * One raw attempt. `value` is optional and may be null — a missing or not-completed
 * attempt is recorded as null, never as a measured zero. The `unit` names the unit
 * the value was captured in; the server converts it to the protocol's canonical unit.
 */
export class AttemptInputDto {
  @ApiPropertyOptional({
    type: Number,
    minimum: ATTEMPT_VALUE_MIN,
    maximum: ATTEMPT_VALUE_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(ATTEMPT_VALUE_MIN)
  @Max(ATTEMPT_VALUE_MAX)
  readonly value?: number | null;

  @ApiProperty({ enum: MeasurementUnit })
  @IsEnum(MeasurementUnit)
  declare readonly unit: MeasurementUnit;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  readonly valid?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  readonly disqualified?: boolean;

  @ApiPropertyOptional({ maxLength: DQ_REASON_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(DQ_REASON_MAX_LENGTH)
  readonly dqReason?: string | null;

  @ApiPropertyOptional({ maxLength: ATTEMPT_NOTE_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(ATTEMPT_NOTE_MAX_LENGTH)
  readonly notes?: string | null;
}
