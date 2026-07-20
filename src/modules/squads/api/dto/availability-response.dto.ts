import { ApiProperty } from '@core/openapi';

import {
  AvailabilitySource,
  AvailabilityStatus,
} from '../../model/squads.enums';

/** A member's availability declaration for a squad's competition/period. */
export class AvailabilityResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly availabilityId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly squadId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ enum: AvailabilityStatus })
  declare readonly availability: AvailabilityStatus;

  @ApiProperty({ type: String, nullable: true })
  declare readonly reason: string | null;

  @ApiProperty({ enum: AvailabilitySource })
  declare readonly source: AvailabilitySource;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly declaredBy: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
