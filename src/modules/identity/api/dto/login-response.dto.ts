import { ApiProperty } from '@core/openapi';
import { MembershipStatus } from '@modules/members';

import { AccountState } from '../../model/identity.enums';

export class AuthTokensDto {
  @ApiProperty()
  declare readonly accessToken: string;

  @ApiProperty()
  declare readonly refreshToken: string;
}

/**
 * One team context the principal personally belongs to. Season fields are null
 * when the team has no resolvable (non-archived) season — never a placeholder.
 * `roles` is informational for navigation shaping; authorization is always
 * decided from `permissions`.
 */
export class AuthMembershipDto {
  @ApiProperty()
  declare readonly membershipId: string;

  @ApiProperty()
  declare readonly teamId: string;

  @ApiProperty()
  declare readonly teamSlug: string;

  @ApiProperty()
  declare readonly teamName: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly seasonSlug: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly seasonName: string | null;

  @ApiProperty({ enum: MembershipStatus })
  declare readonly status: MembershipStatus;

  @ApiProperty({
    type: [String],
    description: 'Lower-snake role slugs live in this team scope',
  })
  declare readonly roles: readonly string[];
}

export class AuthUserDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly email: string;

  @ApiProperty()
  declare readonly displayName: string;

  @ApiProperty({ type: [String] })
  declare readonly permissions: readonly string[];

  @ApiProperty({ enum: AccountState })
  declare readonly accountState: AccountState;

  @ApiProperty()
  declare readonly onboardingComplete: boolean;

  @ApiProperty({ type: [AuthMembershipDto] })
  declare readonly memberships: readonly AuthMembershipDto[];
}

export class LoginResponseDto {
  @ApiProperty({ type: AuthTokensDto })
  declare readonly tokens: AuthTokensDto;

  @ApiProperty({ type: AuthUserDto })
  declare readonly user: AuthUserDto;
}
