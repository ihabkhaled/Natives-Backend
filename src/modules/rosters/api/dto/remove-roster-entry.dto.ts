import { ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsString, MaxLength, MinLength } from '@core/validation';

import {
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
} from '../../model/rosters.constants';

/**
 * Request body to withdraw a player from a roster. The entry is kept with its
 * removal reason so match history is never deleted.
 */
export class RemoveRosterEntryDto {
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
