import { ApiProperty, ApiPropertyOptional } from '@core/openapi';

export class CalendarFeedResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({
    description:
      'Shown once. Treat this calendar subscription token as a secret.',
  })
  declare readonly token: string;

  @ApiProperty()
  declare readonly feedPath: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty()
  declare readonly timezone: string;

  @ApiProperty({ format: 'date-time' })
  declare readonly expiresAt: Date;
}

export class CalendarFeedRevokeResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty()
  declare readonly revoked: boolean;
}
