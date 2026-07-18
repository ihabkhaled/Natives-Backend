import { ApiProperty } from '@core/openapi';

import {
  AgeClassification,
  MemberAudience,
  MembershipStatus,
  PlayerGender,
} from '../../model/members.enums';

/**
 * A member profile shaped for the viewer's resolved audience. Fields the audience
 * may not see are `null`. `audience` names which of the five distinct shapes was
 * rendered (public/teammate/self/coach/admin).
 */
export class MemberViewResponseDto {
  @ApiProperty()
  declare readonly membershipId: string;

  @ApiProperty()
  declare readonly teamId: string;

  @ApiProperty({ enum: MemberAudience })
  declare readonly audience: MemberAudience;

  @ApiProperty({ enum: MembershipStatus })
  declare readonly status: MembershipStatus;

  @ApiProperty()
  declare readonly displayName: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly nickname: string | null;

  @ApiProperty({ type: [String] })
  declare readonly positions: readonly string[];

  @ApiProperty({ type: Number, nullable: true })
  declare readonly jerseyNumber: number | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly division: string | null;

  @ApiProperty()
  declare readonly hasAvatar: boolean;

  @ApiProperty({ type: String, nullable: true })
  declare readonly preferredName: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly fullNameAr: string | null;

  @ApiProperty({ enum: PlayerGender, nullable: true })
  declare readonly gender: PlayerGender | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly fullName: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly jerseySize: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly email: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly phone: string | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly heightCm: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly weightKg: number | null;

  @ApiProperty({ enum: AgeClassification, nullable: true })
  declare readonly ageClassification: AgeClassification | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly dateOfBirth: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly statusReason: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly updatedBy: string | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly version: number | null;
}
