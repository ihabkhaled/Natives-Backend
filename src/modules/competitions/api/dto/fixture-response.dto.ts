import { ApiProperty } from '@core/openapi';

import { FixtureStatus, MatchSide } from '../../model/competitions.enums';

/**
 * A fixture (a scheduled match versus a catalogued opponent), presented with both
 * the stored UTC instant and its Africa/Cairo wall-clock rendering.
 */
export class FixtureResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly fixtureId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly competitionId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly stageId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly roundId: string | null;

  @ApiProperty({ format: 'uuid' })
  declare readonly opponentId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly venueId: string | null;

  @ApiProperty({ enum: MatchSide })
  declare readonly homeAway: MatchSide;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly scheduledAt: Date;

  @ApiProperty({
    description: 'Scheduled instant in Africa/Cairo wall-clock time',
  })
  declare readonly scheduledAtCairo: string;

  @ApiProperty()
  declare readonly timezone: string;

  @ApiProperty({ enum: FixtureStatus })
  declare readonly status: FixtureStatus;

  @ApiProperty()
  declare readonly rescheduleCount: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly previousScheduledAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly rescheduleReason: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly cancellationReason: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly rescheduledAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly finalizedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly cancelledAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
