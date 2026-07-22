import { ApiProperty } from '@core/openapi';

/** One role the acting principal may grant in this team, with display copy. */
export class AssignableRoleEntryDto {
  @ApiProperty({ example: 'coach' })
  declare readonly slug: string;

  @ApiProperty({
    description: 'Server-driven label fallback from the role catalog',
  })
  declare readonly displayName: string;

  @ApiProperty({
    description: 'Privilege summary rendered as the invite-form hint',
  })
  declare readonly description: string;
}

/** The assignable-role catalog projected under the actor's ceiling in a team. */
export class AssignableRolesResponseDto {
  @ApiProperty()
  declare readonly teamId: string;

  @ApiProperty({ type: [AssignableRoleEntryDto] })
  declare readonly roles: readonly AssignableRoleEntryDto[];
}
