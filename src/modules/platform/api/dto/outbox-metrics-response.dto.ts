import { ApiProperty } from '@core/openapi';

/** Aggregate outbox health counters by lifecycle state. */
export class OutboxMetricsResponseDto {
  @ApiProperty()
  declare readonly pending: number;

  @ApiProperty()
  declare readonly processing: number;

  @ApiProperty()
  declare readonly completed: number;

  @ApiProperty()
  declare readonly deadLettered: number;
}
