import { ApiProperty } from '@core/openapi';

import {
  RosterAvailabilitySource,
  RosterAvailabilityStatus,
} from '../../model/rosters.enums';

/** A member's own going / not-going declaration for a roster. */
export class RosterAvailabilityResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly availabilityId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly rosterId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ enum: RosterAvailabilityStatus })
  declare readonly availability: RosterAvailabilityStatus;

  @ApiProperty({ type: String, nullable: true })
  declare readonly reason: string | null;

  @ApiProperty({ enum: RosterAvailabilitySource })
  declare readonly source: RosterAvailabilitySource;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly declaredBy: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
