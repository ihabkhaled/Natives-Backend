import { ApiProperty } from '@core/openapi';

export class LoginResponseDto {
  @ApiProperty()
  declare readonly accessToken: string;
}
