import { ApiProperty } from '@core/openapi';

export class MemberRolesResponseDto {
  @ApiProperty({ description: 'The membership these roles belong to' })
  declare readonly membershipId: string;

  @ApiProperty({
    type: [String],
    description:
      'Role slugs the member currently holds in this team, sorted, lower-snake (for example team_admin)',
  })
  declare readonly roles: readonly string[];

  @ApiProperty({
    type: [String],
    description:
      'Role slugs the acting principal may set here — their privilege ceiling',
  })
  declare readonly assignableRoles: readonly string[];
}
