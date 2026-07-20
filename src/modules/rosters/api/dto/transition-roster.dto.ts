import { ApiProperty } from '@core/openapi';
import { IsEnum, IsInt, Min } from '@core/validation';

import { RECORD_VERSION_MIN } from '../../model/rosters.constants';
import { RosterTransition } from '../../model/rosters.enums';

/**
 * Request body to publish (notifies and snapshots) or archive a roster, guarded
 * by the caller-supplied optimistic record version. Locking and revising are
 * separately permissioned endpoints and are deliberately not reachable here.
 */
export class TransitionRosterDto {
  @ApiProperty({ enum: RosterTransition })
  @IsEnum(RosterTransition)
  declare readonly transition: RosterTransition;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}
