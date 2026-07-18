import { ApiProperty } from '@core/openapi';

import {
  RecurrenceFrequency,
  ScheduleStatus,
  SessionVisibility,
} from '../../model/practices.enums';

export class ScheduleResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly teamId: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty()
  declare readonly sessionType: string;

  @ApiProperty()
  declare readonly timezone: string;

  @ApiProperty({ enum: RecurrenceFrequency })
  declare readonly frequency: RecurrenceFrequency;

  @ApiProperty()
  declare readonly intervalWeeks: number;

  @ApiProperty({ type: [Number] })
  declare readonly weekdays: readonly number[];

  @ApiProperty()
  declare readonly startTimeLocal: string;

  @ApiProperty()
  declare readonly durationMinutes: number;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly meetOffsetMinutes: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly rsvpCutoffMinutes: number | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly defaultVenueId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly defaultField: string | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly defaultCapacity: number | null;

  @ApiProperty({ enum: SessionVisibility })
  declare readonly visibility: SessionVisibility;

  @ApiProperty({ type: String, nullable: true })
  declare readonly organizerUserId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly notes: string | null;

  @ApiProperty()
  declare readonly generationStart: string;

  @ApiProperty()
  declare readonly generationUntil: string;

  @ApiProperty({ type: [String] })
  declare readonly exceptions: readonly string[];

  @ApiProperty({ enum: ScheduleStatus })
  declare readonly status: ScheduleStatus;

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
