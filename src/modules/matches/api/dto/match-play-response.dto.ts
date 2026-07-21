import { ApiProperty } from '@core/openapi';

import {
  AssistState,
  MatchPlayType,
  PointStartingLine,
  ScoringSide,
} from '../../model/matches.enums';

/**
 * One immutable fact on a match's point/possession stream. `retracted` is
 * DERIVED from the existence of a later compensating correction — a recorded
 * fact is never rewritten, so the whole history stays replayable and every
 * derived statistic can be traced back to the facts that produced it.
 */
export class MatchPlayResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly playId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly matchId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty()
  declare readonly sequence: number;

  @ApiProperty()
  declare readonly operationId: string;

  @ApiProperty({ enum: MatchPlayType })
  declare readonly playType: MatchPlayType;

  @ApiProperty()
  declare readonly pointNumber: number;

  @ApiProperty()
  declare readonly period: number;

  @ApiProperty({ enum: PointStartingLine, nullable: true })
  declare readonly startingLine: PointStartingLine | null;

  @ApiProperty({ enum: ScoringSide, nullable: true })
  declare readonly scoringSide: ScoringSide | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly primaryMembershipId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly secondaryMembershipId: string | null;

  @ApiProperty({ enum: AssistState, nullable: true })
  declare readonly assistState: AssistState | null;

  @ApiProperty()
  declare readonly callahan: boolean;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly durationSeconds: number | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly correctsPlayId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly correctionReason: string | null;

  @ApiProperty()
  declare readonly retracted: boolean;

  @ApiProperty({ type: String, nullable: true })
  declare readonly notes: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly recordedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly occurredAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly recordedAt: Date;
}
