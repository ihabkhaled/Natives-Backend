import { ApiProperty } from '@core/openapi';

import { StaffAssignmentStatus } from '../../model/teams.enums';

export class StaffAssignmentResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly teamId: string;

  @ApiProperty()
  declare readonly membershipId: string;

  @ApiProperty()
  declare readonly titleEntryId: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly photoUrl: string | null;

  @ApiProperty({ enum: StaffAssignmentStatus })
  declare readonly status: StaffAssignmentStatus;

  @ApiProperty({ type: String, nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly removedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly removedAt: Date | null;

  @ApiProperty()
  declare readonly version: number;
}
