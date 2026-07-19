import { ApiProperty } from '@core/openapi';

import { ProtocolHistoryEntryResponseDto } from './protocol-history-entry.response.dto';

/** A player's objective-measurement history grouped by protocol. */
export class HistoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ type: [ProtocolHistoryEntryResponseDto] })
  declare readonly entries: readonly ProtocolHistoryEntryResponseDto[];
}
