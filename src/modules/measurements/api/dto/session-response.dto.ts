import { ApiProperty } from '@core/openapi';

import { SessionStatus } from '../../model/measurements.enums';

/** A measurement session with its lifecycle state and scheduling metadata. */
export class SessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty()
  declare readonly title: string;

  @ApiProperty({ enum: SessionStatus })
  declare readonly status: SessionStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly scheduledAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly conductedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly location: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly conditions: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly notes: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
