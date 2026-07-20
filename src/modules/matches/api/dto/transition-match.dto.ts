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
} from '../../model/matches.constants';
import { MatchTransition } from '../../model/matches.enums';

/**
 * Request body for the plain match lifecycle, guarded by the caller-supplied
 * optimistic record version. Abandoning REQUIRES a reason. Finalizing and
 * reopening are separately permissioned endpoints and are deliberately not
 * reachable here.
 */
export class TransitionMatchDto {
  @ApiProperty({ enum: MatchTransition })
  @IsEnum(MatchTransition)
  declare readonly transition: MatchTransition;

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
