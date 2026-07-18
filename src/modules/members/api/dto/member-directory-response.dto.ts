import { ApiProperty } from '@core/openapi';

import { MembershipStatus } from '../../model/members.enums';

/** One coarse directory row — no private fields. */
export class MemberDirectoryItemDto {
  @ApiProperty()
  declare readonly membershipId: string;

  @ApiProperty()
  declare readonly teamId: string;

  @ApiProperty({ enum: MembershipStatus })
  declare readonly status: MembershipStatus;

  @ApiProperty()
  declare readonly displayName: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly nickname: string | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly jerseyNumber: number | null;

  @ApiProperty({ type: [String] })
  declare readonly positions: readonly string[];

  @ApiProperty()
  declare readonly hasAvatar: boolean;
}

/** Paginated envelope for the member directory. */
export class ListMembersResponseDto {
  @ApiProperty({ type: [MemberDirectoryItemDto] })
  declare readonly items: readonly MemberDirectoryItemDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
