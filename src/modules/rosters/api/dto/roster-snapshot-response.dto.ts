import { ApiProperty } from '@core/openapi';

import {
  RosterKind,
  RosterStatus,
  SnapshotReason,
} from '../../model/rosters.enums';
import { RosterSnapshotEntryDto } from './roster-snapshot-entry.dto';

/**
 * An immutable point-in-time record of a roster. What was frozen is exactly what
 * is returned: it is never recomputed on read, and a later squad or roster change
 * leaves it untouched. The checksum makes divergence from the live roster
 * detectable — never repairable.
 */
export class RosterSnapshotResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly snapshotId: string;

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

  @ApiProperty({ enum: RosterKind })
  declare readonly rosterKind: RosterKind;

  @ApiProperty()
  declare readonly revision: number;

  @ApiProperty({ enum: SnapshotReason })
  declare readonly reason: SnapshotReason;

  @ApiProperty({ enum: RosterStatus })
  declare readonly rosterStatus: RosterStatus;

  @ApiProperty()
  declare readonly entryCount: number;

  @ApiProperty()
  declare readonly checksum: string;

  @ApiProperty({ type: [RosterSnapshotEntryDto] })
  declare readonly entries: readonly RosterSnapshotEntryDto[];

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly takenBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly takenAt: Date;
}
