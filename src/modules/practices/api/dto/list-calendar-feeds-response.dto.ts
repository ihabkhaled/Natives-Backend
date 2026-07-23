import { ApiProperty, ApiPropertyOptional } from '@core/openapi';

/**
 * Metadata for one of the caller's own active calendar feeds. Deliberately
 * token-free: the subscription token is shown exactly once, in the create
 * response, and is never readable again (only revocable by feed id).
 */
export class CalendarFeedMetadataResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty()
  declare readonly timezone: string;

  @ApiProperty({ format: 'date-time' })
  declare readonly expiresAt: Date;

  @ApiProperty({ format: 'date-time' })
  declare readonly createdAt: Date;
}

export class ListCalendarFeedsResponseDto {
  @ApiProperty({ type: [CalendarFeedMetadataResponseDto] })
  declare readonly items: readonly CalendarFeedMetadataResponseDto[];
}
