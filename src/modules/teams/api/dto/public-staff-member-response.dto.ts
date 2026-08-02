import { ApiProperty } from '@core/openapi';

export class PublicStaffMemberResponseDto {
  @ApiProperty()
  declare readonly membershipId: string;

  @ApiProperty()
  declare readonly displayName: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly nickname: string | null;

  @ApiProperty({ type: [String] })
  declare readonly titles: readonly string[];

  @ApiProperty({ type: String, nullable: true })
  declare readonly photoUrl: string | null;
}
