import { ApiProperty } from '@core/openapi';

export class SessionResponseDto {
  @ApiProperty()
  declare readonly accessToken: string;

  @ApiProperty()
  declare readonly refreshToken: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly refreshTokenExpiresAt: Date;

  @ApiProperty()
  declare readonly userId: string;
}
