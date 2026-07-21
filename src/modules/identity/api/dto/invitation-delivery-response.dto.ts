import { ApiProperty } from '@core/openapi';

import { InvitationResponseDto } from './invitation-response.dto';

/**
 * Create/resend invitation response. Extends the read-only summary with the
 * one-time plaintext token so the privileged admin can hand the invite link
 * (`/accept-invitation?token=<token>`) over manually while no email provider is
 * configured (open decision OD-002). The token is shown exactly once, on the
 * response that mints it; it is never persisted in plaintext and never returned
 * by any read path.
 */
export class InvitationDeliveryResponseDto extends InvitationResponseDto {
  @ApiProperty({
    description:
      'One-time plaintext invitation token for manual link delivery (OD-002). Shown once; store the hash only.',
  })
  declare readonly token: string;
}
