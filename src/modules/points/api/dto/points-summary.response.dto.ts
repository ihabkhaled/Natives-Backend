import { ApiProperty } from '@core/openapi';

import { LedgerEntryResponseDto } from './ledger-entry-response.dto';
import { PlayerBadgeResponseDto } from './player-badge-response.dto';

/**
 * A member's points summary: the projected total (sum of ledger entries, never a
 * stored counter), the bounded ledger history, and the badges earned.
 */
export class PointsSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty({ type: [LedgerEntryResponseDto] })
  declare readonly entries: readonly LedgerEntryResponseDto[];

  @ApiProperty({ type: [PlayerBadgeResponseDto] })
  declare readonly badges: readonly PlayerBadgeResponseDto[];
}
