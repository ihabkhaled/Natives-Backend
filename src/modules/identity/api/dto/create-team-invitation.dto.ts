import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import { IsEmail, IsOptional, Matches, MaxLength } from '@core/validation';
import { ROLE_SLUG_MAX_LENGTH, ROLE_SLUG_PATTERN } from '@modules/rbac';

import { EMAIL_MAX_LENGTH } from '../../model/identity.constants';

/**
 * Team-scoped invitation request. Deliberately carries no account-role field:
 * a team-scoped inviter onboards regular `user` accounts only — minting an
 * `admin` account stays a platform-scoped capability. The optional team role
 * is shape-validated here and resolved by RBAC against the open catalog and
 * the inviter's privilege ceiling inside the transaction.
 */
export class CreateTeamInvitationDto {
  @ApiProperty({ maxLength: EMAIL_MAX_LENGTH })
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  declare readonly email: string;

  /** Team role slug from the assignable catalog. Default: member. */
  @ApiPropertyOptional({
    example: 'coach',
    pattern: '^[a-z][a-z0-9_]*$',
    maxLength: ROLE_SLUG_MAX_LENGTH,
  })
  @IsOptional()
  @Matches(ROLE_SLUG_PATTERN)
  @MaxLength(ROLE_SLUG_MAX_LENGTH)
  declare readonly teamRole?: string;
}
