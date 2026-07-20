import { ApiProperty } from '@core/openapi';

import { MatchEventType, ScoringSide } from '../../model/matches.enums';

/**
 * One immutable fact on a match's stream. `voided` is DERIVED from the existence
 * of a later compensating event — a recorded fact is never rewritten, so the
 * whole history stays replayable and the displayed score is reproducible.
 */
export class MatchEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly eventId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly matchId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty()
  declare readonly sequence: number;

  @ApiProperty()
  declare readonly operationId: string;

  @ApiProperty({ enum: MatchEventType })
  declare readonly eventType: MatchEventType;

  @ApiProperty({ enum: ScoringSide, nullable: true })
  declare readonly scoringSide: ScoringSide | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly points: number | null;

  @ApiProperty()
  declare readonly ourScoreAfter: number;

  @ApiProperty()
  declare readonly opponentScoreAfter: number;

  @ApiProperty()
  declare readonly period: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly scorerMembershipId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly assistMembershipId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly voidsEventId: string | null;

  @ApiProperty()
  declare readonly voided: boolean;

  @ApiProperty({ type: String, nullable: true })
  declare readonly voidReason: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly recordedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly occurredAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly recordedAt: Date;
}
