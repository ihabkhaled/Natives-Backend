import { ApiProperty } from '@core/openapi';

/** Acknowledgement that a dead-lettered event was requeued for replay. */
export class ReplayResponseDto {
  @ApiProperty()
  declare readonly eventId: string;

  @ApiProperty()
  declare readonly requeued: boolean;
}
