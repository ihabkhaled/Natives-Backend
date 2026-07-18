import { ApiProperty } from '@core/openapi';

import { StatusEventResponseDto } from './status-event-response.dto';

export class SessionHistoryResponseDto {
  @ApiProperty({ type: [StatusEventResponseDto] })
  declare readonly items: readonly StatusEventResponseDto[];
}
