import { ApiProperty } from '@core/openapi';

import { SeasonStatus } from '../../model/teams.enums';

export class SeasonResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly teamId: string;

  @ApiProperty()
  declare readonly slug: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ format: 'date', example: '2026-01-01' })
  declare readonly startsOn: string;

  @ApiProperty({ format: 'date', example: '2026-06-30' })
  declare readonly endsOn: string;

  @ApiProperty({ enum: SeasonStatus })
  declare readonly status: SeasonStatus;

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
