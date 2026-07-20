import { ApiProperty } from '@core/openapi';

import {
  RosterAvailabilityStatus,
  RosterEntryRole,
  RosterEntryStatus,
  RosterGenderBucket,
  RosterLine,
  RosterPosition,
} from '../../model/rosters.enums';

/**
 * One roster entry with its jersey, role, line, position, gender bucket, the
 * availability known at selection (null when nothing was declared — never zero or
 * "unavailable"), and the override evidence when a flagged player was accepted.
 */
export class RosterEntryResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly entryId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly rosterId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

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

  @ApiProperty({ enum: RosterEntryStatus })
  declare readonly status: RosterEntryStatus;

  @ApiProperty({ enum: RosterAvailabilityStatus, nullable: true })
  declare readonly availability: RosterAvailabilityStatus | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly selectionReason: string | null;

  @ApiProperty()
  declare readonly constraintOverridden: boolean;

  @ApiProperty({ type: String, nullable: true })
  declare readonly overrideReason: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly overriddenBy: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly selectedBy: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly removedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly removedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly removalReason: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
