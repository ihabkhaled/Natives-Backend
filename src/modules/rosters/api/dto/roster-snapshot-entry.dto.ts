import { ApiProperty } from '@core/openapi';

import {
  RosterAvailabilityStatus,
  RosterEntryRole,
  RosterGenderBucket,
  RosterLine,
  RosterPosition,
} from '../../model/rosters.enums';

/**
 * One frozen entry inside a snapshot: ids and classifications only. A snapshot
 * records WHO was selected and HOW, never personal detail, so historical rosters
 * can be retained and audited without duplicating profile data.
 */
export class RosterSnapshotEntryDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly jerseyNumber: number | null;

  @ApiProperty({ enum: RosterEntryRole })
  declare readonly entryRole: RosterEntryRole;

  @ApiProperty({ enum: RosterLine })
  declare readonly lineAssignment: RosterLine;

  @ApiProperty({ enum: RosterPosition })
  declare readonly fieldPosition: RosterPosition;

  @ApiProperty({ enum: RosterGenderBucket })
  declare readonly genderBucket: RosterGenderBucket;

  @ApiProperty({ enum: RosterAvailabilityStatus, nullable: true })
  declare readonly availability: RosterAvailabilityStatus | null;

  @ApiProperty()
  declare readonly constraintOverridden: boolean;
}
