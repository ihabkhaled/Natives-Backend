import { ApiProperty } from '@core/openapi';

import { LedgerEntryType, LedgerSourceType } from '../../model/points.enums';

/** One immutable ledger line in a member's points history. */
export class LedgerEntryResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ enum: LedgerEntryType })
  declare readonly entryType: LedgerEntryType;

  @ApiProperty()
  declare readonly amount: number;

  @ApiProperty({ enum: LedgerSourceType })
  declare readonly sourceType: LedgerSourceType;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly ruleVersion: number | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly activityCategory: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly reason: string | null;

  @ApiProperty({ type: String, format: 'date' })
  declare readonly effectiveOn: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;
}
