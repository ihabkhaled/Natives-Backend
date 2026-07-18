import { ApiProperty } from '@core/openapi';

import { AccountState } from '../../model/identity.enums';

export class AuthTokensDto {
  @ApiProperty()
  declare readonly accessToken: string;

  @ApiProperty()
  declare readonly refreshToken: string;
}

export class AuthMembershipDto {
  @ApiProperty()
  declare readonly teamId: string;

  @ApiProperty()
  declare readonly teamName: string;

  @ApiProperty()
  declare readonly seasonId: string;

  @ApiProperty()
  declare readonly seasonName: string;
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
