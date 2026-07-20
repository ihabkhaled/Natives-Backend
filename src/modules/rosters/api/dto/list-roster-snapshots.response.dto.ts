import { ApiProperty } from '@core/openapi';

import { RosterSnapshotResponseDto } from './roster-snapshot-response.dto';

/** A bounded page of a roster's immutable snapshots, newest first. */
export class ListRosterSnapshotsResponseDto {
  @ApiProperty({ type: [RosterSnapshotResponseDto] })
  declare readonly items: readonly RosterSnapshotResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
