import { ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsString, MaxLength, MinLength } from '@core/validation';

import {
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
} from '../../model/squads.constants';

/** Request body to remove a player from a squad, with an optional reason. */
export class RemoveSelectionDto {
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
