import { ApiProperty } from '@core/openapi';

export class DeviceSessionResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly device: string;

  @ApiProperty()
  declare readonly approxLocation: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly lastActiveAt: Date;

  @ApiProperty()
  declare readonly current: boolean;
}
