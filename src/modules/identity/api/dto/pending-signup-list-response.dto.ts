import { ApiProperty } from '@core/openapi';

import { PendingSignupResponseDto } from './pending-signup-response.dto';

/** The admin review queue: every self-signup still awaiting a decision. */
export class PendingSignupListResponseDto {
  @ApiProperty({ type: [PendingSignupResponseDto] })
  declare readonly items: readonly PendingSignupResponseDto[];
}
