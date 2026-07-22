import { ApiProperty } from '@core/openapi';

/**
 * One dead-lettered outbox event. Privacy is encoded in the shape: identity,
 * type, attempts, when it failed, and a STABLE failure classification — no
 * payload field and no raw error text exist on the wire at all.
 */
export class DeadLetterResponseDto {
  @ApiProperty()
  declare readonly eventId: string;

  @ApiProperty({ example: 'member.invited' })
  declare readonly eventType: string;

  @ApiProperty()
  declare readonly attempts: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly failedAt: Date;

  @ApiProperty({ example: 'handler_failed' })
  declare readonly failureCode: string;
}

/** Paginated envelope for the dead-letter listing. */
export class DeadLetterListResponseDto {
  @ApiProperty({ type: [DeadLetterResponseDto] })
  declare readonly items: readonly DeadLetterResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
