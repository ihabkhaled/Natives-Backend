import { ApiProperty } from '@core/openapi';

export class MessageResponseDto {
  @ApiProperty()
  declare readonly message: string;
}
