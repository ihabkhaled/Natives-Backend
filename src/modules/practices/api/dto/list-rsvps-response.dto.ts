import { ApiProperty } from '@core/openapi';

import { RsvpParticipantResponseDto } from './rsvp-participant-response.dto';

export class ListRsvpsResponseDto {
  @ApiProperty({ type: [RsvpParticipantResponseDto] })
  declare readonly items: readonly RsvpParticipantResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
