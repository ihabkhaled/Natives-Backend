import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from '@core/validation';

import {
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  RECORD_VERSION_MIN,
} from '../../model/competitions.constants';
import { FixtureTransition } from '../../model/competitions.enums';

/**
 * Request body to move a fixture through its lifecycle. A reason is required only
 * for a cancellation (enforced in the domain) and is retained for history.
 */
export class TransitionFixtureDto {
  @ApiProperty({ enum: FixtureTransition })
  @IsEnum(FixtureTransition)
  declare readonly transition: FixtureTransition;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;

  @ApiPropertyOptional({
    minLength: REASON_MIN_LENGTH,
    maxLength: REASON_MAX_LENGTH,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  readonly reason?: string | null;
}
