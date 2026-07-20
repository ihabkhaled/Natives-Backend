import { ApiProperty } from '@core/openapi';
import { IsString, MaxLength, MinLength } from '@core/validation';

import {
  OVERRIDE_REASON_MAX_LENGTH,
  OVERRIDE_REASON_MIN_LENGTH,
} from '../../model/squads.constants';
import { SelectPlayerDto } from './select-player.dto';

/**
 * Request body to select a player an eligibility signal flags, via the override
 * endpoint (which additionally requires squad.override_eligibility). The override
 * reason is mandatory and recorded as audit evidence that a permitted human
 * consciously accepted the flag — the signal itself never excluded the player.
 */
export class OverrideSelectPlayerDto extends SelectPlayerDto {
  @ApiProperty({
    minLength: OVERRIDE_REASON_MIN_LENGTH,
    maxLength: OVERRIDE_REASON_MAX_LENGTH,
  })
  @IsString()
  @MinLength(OVERRIDE_REASON_MIN_LENGTH)
  @MaxLength(OVERRIDE_REASON_MAX_LENGTH)
  declare readonly overrideReason: string;
}
