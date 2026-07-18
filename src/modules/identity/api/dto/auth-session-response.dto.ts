import { ApiProperty } from '@core/openapi';

export class AuthSessionResponseDto {
  @ApiProperty()
  declare readonly accessToken: string;

  @ApiProperty()
  declare readonly refreshToken: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly refreshTokenExpiresAt: Date;

  @ApiProperty()
  declare readonly userId: string;
}
