import { ApiProperty } from '@core/openapi';
import { IsEnum, IsInt, Min } from '@core/validation';

import { RECORD_VERSION_MIN } from '../../model/squads.constants';
import { SquadTransition } from '../../model/squads.enums';

/**
 * Request body to move a squad through its lifecycle: publish (notifies), lock
 * (freezes the roster), revise (back to draft, preserving history), or archive.
 * Guarded by the caller-supplied optimistic record version.
 */
export class TransitionSquadDto {
  @ApiProperty({ enum: SquadTransition })
  @IsEnum(SquadTransition)
  declare readonly transition: SquadTransition;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}
