import { ApiProperty } from '@core/openapi';

import { RsvpRevisionResponseDto } from './rsvp-revision-response.dto';

export class RsvpHistoryResponseDto {
  @ApiProperty({ type: [RsvpRevisionResponseDto] })
  declare readonly items: readonly RsvpRevisionResponseDto[];
}
