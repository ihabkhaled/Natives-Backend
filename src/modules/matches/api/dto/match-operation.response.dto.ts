import { ApiProperty } from '@core/openapi';

import { OperationOutcome } from '../../model/matches.enums';
import { MatchEventResponseDto } from './match-event-response.dto';

/**
 * The authoritative answer to a scoring operation. `outcome` tells an offline
 * device whether its operation was newly APPLIED or was a faithful REPLAY of one
 * the server already holds — both return the same event and the same score, which
 * is exactly what makes a queued retry safe. A differing payload under the same
 * operation id never reaches this shape: it is a 409.
 */
export class MatchOperationResponseDto {
  @ApiProperty({ enum: OperationOutcome })
  declare readonly outcome: OperationOutcome;

  @ApiProperty({ type: MatchEventResponseDto })
  declare readonly event: MatchEventResponseDto;

  @ApiProperty()
  declare readonly streamVersion: number;

  @ApiProperty()
  declare readonly ourScore: number;

  @ApiProperty()
  declare readonly opponentScore: number;
}
