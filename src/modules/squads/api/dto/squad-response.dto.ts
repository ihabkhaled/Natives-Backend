import { ApiProperty } from '@core/openapi';

import { SquadStatus } from '../../model/squads.enums';

/** A squad with its lifecycle timestamps and configuration. */
export class SquadResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly squadId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly seasonId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly competitionId: string | null;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ enum: SquadStatus })
  declare readonly status: SquadStatus;

  @ApiProperty()
  declare readonly attendanceThresholdPct: number;

  @ApiProperty()
  declare readonly policyVersion: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly selectionDeadline: Date | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly notes: string | null;

  @ApiProperty()
  declare readonly revision: number;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly publishedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly publishedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly lockedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly archivedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
