import { ApiProperty } from '@core/openapi';

import { MatchRevisionAction, MatchStatus } from '../../model/matches.enums';

/**
 * One immutable entry in the correction trail. Carrying the score before and
 * after is what makes a changed final score an attributable, reviewable delta
 * instead of a silent merge.
 */
export class MatchRevisionResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly revisionId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly matchId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty()
  declare readonly sequence: number;

  @ApiProperty()
  declare readonly revision: number;

  @ApiProperty({ enum: MatchRevisionAction })
  declare readonly action: MatchRevisionAction;

  @ApiProperty()
  declare readonly reason: string;

  @ApiProperty({ enum: MatchStatus })
  declare readonly fromStatus: MatchStatus;

  @ApiProperty({ enum: MatchStatus })
  declare readonly toStatus: MatchStatus;

  @ApiProperty()
  declare readonly ourScoreBefore: number;

  @ApiProperty()
  declare readonly opponentScoreBefore: number;

  @ApiProperty()
  declare readonly ourScoreAfter: number;

  @ApiProperty()
  declare readonly opponentScoreAfter: number;

  @ApiProperty()
  declare readonly streamVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly actorUserId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;
}
