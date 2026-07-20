import { ApiProperty } from '@core/openapi';

import {
  RosterDivision,
  RosterKind,
  RosterStatus,
} from '../../model/rosters.enums';

/**
 * A roster with its lifecycle, revision chain, composition constraints, and the
 * id of the immutable snapshot it last froze — the stable handle points, events,
 * and reports reference instead of re-deriving a historical selection.
 */
export class RosterResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly rosterId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly seasonId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly competitionId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly fixtureId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly squadId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly sourceRosterId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly supersedesRosterId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly currentSnapshotId: string | null;

  @ApiProperty({ enum: RosterKind })
  declare readonly rosterKind: RosterKind;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ enum: RosterStatus })
  declare readonly status: RosterStatus;

  @ApiProperty({ enum: RosterDivision })
  declare readonly division: RosterDivision;

  @ApiProperty()
  declare readonly minSize: number;

  @ApiProperty()
  declare readonly maxSize: number;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly minWomen: number | null;

  @ApiProperty()
  declare readonly requireCaptain: boolean;

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

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly lockedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly lockedAt: Date | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly revisedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly revisedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly revisionReason: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly archivedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
