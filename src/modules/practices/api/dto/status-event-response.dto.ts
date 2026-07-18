import { ApiProperty } from '@core/openapi';

import { SessionStatus } from '../../model/practices.enums';

export class StatusEventResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly sessionId: string;

  @ApiProperty({ enum: SessionStatus, nullable: true })
  declare readonly fromStatus: SessionStatus | null;

  @ApiProperty({ enum: SessionStatus })
  declare readonly toStatus: SessionStatus;

  @ApiProperty({ type: String, nullable: true })
  declare readonly reason: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly actorUserId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly occurredAt: Date;
}
