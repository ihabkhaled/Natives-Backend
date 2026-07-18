import { ApiProperty, ApiPropertyOptional } from '@core/openapi';

import { ReminderKind } from '../../model/calendar.enums';

export class ReminderPreviewResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly sessionId: string;

  @ApiProperty()
  declare readonly totalEligible: number;

  @ApiProperty()
  declare readonly noResponse: number;

  @ApiProperty()
  declare readonly upcoming: boolean;

  @ApiProperty()
  declare readonly cutoff: boolean;

  @ApiProperty()
  declare readonly urgentCancellationOverride: boolean;

  @ApiProperty({ enum: ReminderKind, isArray: true })
  declare readonly kinds: readonly ReminderKind[];
}

export class ReminderDispatchResponseDto {
  @ApiProperty()
  declare readonly candidates: number;

  @ApiProperty()
  declare readonly enqueued: number;
}

export class ReminderTestResponseDto {
  @ApiProperty()
  declare readonly enqueued: boolean;

  @ApiPropertyOptional({
    type: String,
    enum: ['quiet_hours'],
    nullable: true,
  })
  declare readonly reason: 'quiet_hours' | null;
}
