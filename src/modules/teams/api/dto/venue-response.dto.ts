import { ApiProperty } from '@core/openapi';

import { ResourceStatus } from '../../model/teams.enums';

export class VenueResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly teamId: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly address: string | null;

  @ApiProperty()
  declare readonly timezone: string;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly latitude: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly longitude: number | null;

  @ApiProperty({ enum: ResourceStatus })
  declare readonly status: ResourceStatus;

  @ApiProperty({ type: String, nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly updatedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;

  @ApiProperty()
  declare readonly version: number;
}
