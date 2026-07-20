import { ApiProperty } from '@core/openapi';

import { CapKind, MatchResult, MatchStatus } from '../../model/matches.enums';

/**
 * A match with its lifecycle, its score PROJECTION, the authoritative stream
 * version concurrent devices are guarded against, the revision the correction
 * trail is keyed on, and the engine version that explains its caps.
 */
export class MatchResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly matchId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly seasonId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly competitionId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly fixtureId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly rosterId: string | null;

  @ApiProperty({ format: 'uuid' })
  declare readonly rulesetId: string;

  @ApiProperty({ enum: MatchStatus })
  declare readonly status: MatchStatus;

  @ApiProperty()
  declare readonly homeAway: string;

  @ApiProperty()
  declare readonly ourScore: number;

  @ApiProperty()
  declare readonly opponentScore: number;

  @ApiProperty()
  declare readonly period: number;

  @ApiProperty()
  declare readonly streamVersion: number;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty()
  declare readonly revision: number;

  @ApiProperty({ enum: MatchResult })
  declare readonly result: MatchResult;

  @ApiProperty({ enum: CapKind })
  declare readonly capApplied: CapKind;

  @ApiProperty()
  declare readonly engineVersion: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly supersedesMatchId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly reopenReason: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly reopenedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly reopenedAt: Date | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly startedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly pausedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly resumedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly halftimeAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly completedAt: Date | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly finalizedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly finalizedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly abandonedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly abandonReason: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly notes: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
