import { ApiProperty } from '@core/openapi';

/** Count of privacy-safe reminder events queued by a development reminder scan. */
export class RemindersResponseDto {
  @ApiProperty()
  declare readonly feedbackReminders: number;

  @ApiProperty()
  declare readonly goalReminders: number;
}
