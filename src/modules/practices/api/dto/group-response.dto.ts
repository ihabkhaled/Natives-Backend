import { ApiProperty } from '@core/openapi';

import { GroupMemberResponseDto } from './group-member-response.dto';

/** A participant group with its assigned coach and members. */
export class GroupResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly color: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly coachMembershipId: string | null;

  @ApiProperty()
  declare readonly position: number;

  @ApiProperty({ type: String, nullable: true })
  declare readonly notes: string | null;

  @ApiProperty({ type: [GroupMemberResponseDto] })
  declare readonly members: readonly GroupMemberResponseDto[];
}
