import { ApiProperty } from '@core/openapi';

import { AuditOutcome } from '../../model/platform.enums';
import type { ScalarPayload } from '../../model/platform.types';

/** One immutable audit entry (redacted diff). */
export class AuditEntryDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly actorUserId: string | null;

  @ApiProperty()
  declare readonly action: string;

  @ApiProperty()
  declare readonly resourceType: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly resourceId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly teamId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly correlationId: string | null;

  @ApiProperty({ enum: AuditOutcome })
  declare readonly outcome: AuditOutcome;

  @ApiProperty({ type: Object })
  declare readonly diff: ScalarPayload;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly occurredAt: Date;
}

/** Paginated envelope for the team audit ledger. */
export class ListAuditResponseDto {
  @ApiProperty({ type: [AuditEntryDto] })
  declare readonly items: readonly AuditEntryDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
