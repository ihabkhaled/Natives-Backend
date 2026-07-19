import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from '@core/validation';

import {
  PROTOCOL_KEY_MAX_LENGTH,
  PROTOCOL_KEY_MIN_LENGTH,
  PROTOCOL_NAME_MAX_LENGTH,
  PROTOCOL_NAME_MIN_LENGTH,
  PROTOCOL_TEXT_MAX_LENGTH,
  PROTOCOL_VALUE_MAX,
  PROTOCOL_VALUE_MIN,
} from '../../model/measurements.constants';
import {
  MeasurementDirection,
  MeasurementDiscipline,
  MeasurementUnit,
  ResultPolicy,
} from '../../model/measurements.enums';

/**
 * Request body for creating an objective measurement protocol. The canonical
 * unit, better-higher/lower direction, and best/average/latest result policy are
 * part of the definition — a protocol is never coerced onto a 0–5 subjective scale.
 */
export class CreateProtocolDto {
  @ApiProperty({
    minLength: PROTOCOL_KEY_MIN_LENGTH,
    maxLength: PROTOCOL_KEY_MAX_LENGTH,
  })
  @IsString()
  @MinLength(PROTOCOL_KEY_MIN_LENGTH)
  @MaxLength(PROTOCOL_KEY_MAX_LENGTH)
  declare readonly protocolKey: string;

  @ApiProperty({
    minLength: PROTOCOL_NAME_MIN_LENGTH,
    maxLength: PROTOCOL_NAME_MAX_LENGTH,
  })
  @IsString()
  @MinLength(PROTOCOL_NAME_MIN_LENGTH)
  @MaxLength(PROTOCOL_NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiPropertyOptional({ maxLength: PROTOCOL_TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(PROTOCOL_TEXT_MAX_LENGTH)
  readonly description?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string | null;

  @ApiProperty({ enum: MeasurementDiscipline })
  @IsEnum(MeasurementDiscipline)
  declare readonly discipline: MeasurementDiscipline;

  @ApiProperty({ enum: MeasurementUnit })
  @IsEnum(MeasurementUnit)
  declare readonly unit: MeasurementUnit;

  @ApiProperty({ enum: MeasurementDirection })
  @IsEnum(MeasurementDirection)
  declare readonly direction: MeasurementDirection;

  @ApiProperty({ enum: ResultPolicy })
  @IsEnum(ResultPolicy)
  declare readonly resultPolicy: ResultPolicy;

  @ApiPropertyOptional({ maxLength: PROTOCOL_TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(PROTOCOL_TEXT_MAX_LENGTH)
  readonly instructions?: string | null;

  @ApiPropertyOptional({ maxLength: PROTOCOL_TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(PROTOCOL_TEXT_MAX_LENGTH)
  readonly safetyNotes?: string | null;

  @ApiPropertyOptional({
    minimum: PROTOCOL_VALUE_MIN,
    maximum: PROTOCOL_VALUE_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(PROTOCOL_VALUE_MIN)
  @Max(PROTOCOL_VALUE_MAX)
  readonly minValue?: number | null;

  @ApiPropertyOptional({
    minimum: PROTOCOL_VALUE_MIN,
    maximum: PROTOCOL_VALUE_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(PROTOCOL_VALUE_MIN)
  @Max(PROTOCOL_VALUE_MAX)
  readonly maxValue?: number | null;
}
