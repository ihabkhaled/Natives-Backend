import { ApiProperty } from '@core/openapi';

import { DeviceSessionResponseDto } from './device-session-response.dto';

export class SessionListResponseDto {
  @ApiProperty({ type: [DeviceSessionResponseDto] })
  declare readonly sessions: readonly DeviceSessionResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
