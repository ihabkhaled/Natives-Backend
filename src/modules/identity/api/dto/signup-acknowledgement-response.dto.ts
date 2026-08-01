import { ApiProperty } from '@core/openapi';

import { AccountState } from '../../model/identity.enums';

/**
 * Response to a public self-signup: a human-readable acknowledgement plus the
 * account state so the web app can render the awaiting-approval screen. Never
 * carries a token or session — signup grants no access on its own.
 */
export class SignupAcknowledgementResponseDto {
  @ApiProperty()
  declare readonly message: string;

  @ApiProperty({
    enum: AccountState,
    description: 'Always "pending" immediately after signup',
  })
  declare readonly state: AccountState;
}
