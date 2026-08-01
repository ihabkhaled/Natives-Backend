import { ApiProperty } from '@core/openapi';

import { AccountState } from '../../model/identity.enums';

/**
 * One pending self-signup as shown in the admin review queue and returned by the
 * approve/reject endpoints. Credential-free by construction.
 */
export class PendingSignupResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly email: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly displayName: string | null;

  @ApiProperty({ enum: AccountState })
  declare readonly state: AccountState;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly requestedAt: Date;
}
