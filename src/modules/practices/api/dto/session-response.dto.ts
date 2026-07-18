import { ApiProperty } from '@core/openapi';

import { SessionStatus, SessionVisibility } from '../../model/practices.enums';

export class SessionResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly teamId: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly scheduleId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly occurrenceDate: string | null;

  @ApiProperty()
  declare readonly sessionType: string;

  @ApiProperty()
  declare readonly timezone: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly venueId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly field: string | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly capacity: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly meetAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly startsAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly endsAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly rsvpCutoffAt: Date | null;

  @ApiProperty({ enum: SessionVisibility })
  declare readonly visibility: SessionVisibility;

  @ApiProperty({ type: String, nullable: true })
  declare readonly organizerUserId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly notes: string | null;

  @ApiProperty({ enum: SessionStatus })
  declare readonly status: SessionStatus;

  @ApiProperty({ type: String, nullable: true })
  declare readonly cancellationReason: string | null;

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
