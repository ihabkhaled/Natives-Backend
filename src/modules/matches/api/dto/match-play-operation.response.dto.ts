import { ApiProperty } from '@core/openapi';

import { OperationOutcome } from '../../model/matches.enums';
import { MatchPlayResponseDto } from './match-play-response.dto';
import { MatchPointLineupDto } from './match-point-lineup.dto';

/**
 * The authoritative answer to a point-stream operation. `outcome` tells an
 * offline device whether its operation was newly APPLIED or was a faithful
 * REPLAY of one the server already holds — both return the same fact and the
 * same line, which is what makes a queued retry safe. A differing payload under
 * the same operation id never reaches this shape: it is a 409.
 */
export class MatchPlayOperationResponseDto {
  @ApiProperty({ enum: OperationOutcome })
  declare readonly outcome: OperationOutcome;

  @ApiProperty({ type: MatchPlayResponseDto })
  declare readonly play: MatchPlayResponseDto;

  @ApiProperty()
  declare readonly pointNumber: number;

  @ApiProperty({ type: [MatchPointLineupDto] })
  declare readonly lineup: readonly MatchPointLineupDto[];
}
