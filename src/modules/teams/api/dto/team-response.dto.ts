import { ApiProperty } from '@core/openapi';

import { ResourceStatus } from '../../model/teams.enums';

export class TeamResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly slug: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty()
  declare readonly locale: string;

  @ApiProperty()
  declare readonly timezone: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly primaryColor: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly logoMediaKey: string | null;

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
