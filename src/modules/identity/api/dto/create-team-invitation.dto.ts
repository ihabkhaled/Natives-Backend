import { ApiProperty } from '@core/openapi';
import { IsEmail, MaxLength } from '@core/validation';

import { EMAIL_MAX_LENGTH } from '../../model/identity.constants';

/**
 * Team-scoped invitation request. Deliberately carries no account-role field:
 * a team-scoped inviter onboards regular `user` accounts only — minting an
 * `admin` account stays a platform-scoped capability.
 */
export class CreateTeamInvitationDto {
  @ApiProperty({ maxLength: EMAIL_MAX_LENGTH })
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  declare readonly email: string;
}
