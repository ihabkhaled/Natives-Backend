import { ApiProperty } from '@core/openapi';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
} from '@core/validation';

import {
  MEMBER_ROLE_SLUG_MAX_LENGTH,
  MEMBER_ROLES_MAX_COUNT,
} from '../../model/members.constants';

/**
 * Replace the member's team role set. The list is absolute: roles present are
 * granted, roles absent are revoked. Unknown slugs are rejected; every grant and
 * revoke is checked against the actor's privilege ceiling by the RBAC module.
 */
export class AssignMemberRolesDto {
  @ApiProperty({
    type: [String],
    maxItems: MEMBER_ROLES_MAX_COUNT,
    description: 'Role slugs, lower-snake (member, coach, team_admin, …)',
  })
  @IsArray()
  @ArrayMaxSize(MEMBER_ROLES_MAX_COUNT)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(MEMBER_ROLE_SLUG_MAX_LENGTH, { each: true })
  declare readonly roles: readonly string[];
}
