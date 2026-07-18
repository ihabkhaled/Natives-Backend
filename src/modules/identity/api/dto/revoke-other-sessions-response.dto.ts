import { ApiProperty } from '@core/openapi';

export class RevokeOtherSessionsResponseDto {
  @ApiProperty()
  declare readonly revokedCount: number;
}
