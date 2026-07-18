import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from '@core/validation';

import {
  CAPACITY_MAX,
  CAPACITY_MIN,
  EXPECTED_VERSION_MIN,
  FIELD_MAX_LENGTH,
  NOTES_MAX_LENGTH,
} from '../../model/practices.constants';
import { SessionVisibility } from '../../model/practices.enums';

/** Presentation-detail update of a session (never its times), version-guarded. */
export class UpdateSessionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly venueId?: string;

  @ApiPropertyOptional({ maxLength: FIELD_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(FIELD_MAX_LENGTH)
  declare readonly field?: string;

  @ApiPropertyOptional({ minimum: CAPACITY_MIN, maximum: CAPACITY_MAX })
  @IsOptional()
  @IsInt()
  @Min(CAPACITY_MIN)
  @Max(CAPACITY_MAX)
  declare readonly capacity?: number;

  @ApiPropertyOptional({ maxLength: NOTES_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(NOTES_MAX_LENGTH)
  declare readonly notes?: string;

  @ApiProperty({ enum: SessionVisibility })
  @IsEnum(SessionVisibility)
  declare readonly visibility: SessionVisibility;

  @ApiProperty({ minimum: EXPECTED_VERSION_MIN })
  @IsInt()
  @Min(EXPECTED_VERSION_MIN)
  declare readonly expectedVersion: number;
}
