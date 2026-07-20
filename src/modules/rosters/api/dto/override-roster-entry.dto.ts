import { ApiProperty } from '@core/openapi';
import { IsString, MaxLength, MinLength } from '@core/validation';

import {
  OVERRIDE_REASON_MAX_LENGTH,
  OVERRIDE_REASON_MIN_LENGTH,
} from '../../model/rosters.constants';
import { AddRosterEntryDto } from './add-roster-entry.dto';

/**
 * Request body to add a FLAGGED player with an explicit override. The reason is
 * mandatory and is stored on the entry as immutable evidence that a permitted
 * human consciously accepted the flag.
 */
export class OverrideRosterEntryDto extends AddRosterEntryDto {
  @ApiProperty({
    minLength: OVERRIDE_REASON_MIN_LENGTH,
    maxLength: OVERRIDE_REASON_MAX_LENGTH,
  })
  @IsString()
  @MinLength(OVERRIDE_REASON_MIN_LENGTH)
  @MaxLength(OVERRIDE_REASON_MAX_LENGTH)
  declare readonly overrideReason: string;
}
