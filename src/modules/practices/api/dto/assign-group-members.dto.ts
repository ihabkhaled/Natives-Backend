import { ApiProperty } from '@core/openapi';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from '@core/validation';

import {
  ASSIGN_MEMBERS_MAX_COUNT,
  ASSIGN_MEMBERS_MIN_COUNT,
} from '../../model/agendas.constants';

/** Body for assigning one or more team memberships to a participant group. */
export class AssignGroupMembersDto {
  @ApiProperty({
    type: [String],
    minItems: ASSIGN_MEMBERS_MIN_COUNT,
    maxItems: ASSIGN_MEMBERS_MAX_COUNT,
  })
  @IsArray()
  @ArrayMinSize(ASSIGN_MEMBERS_MIN_COUNT)
  @ArrayMaxSize(ASSIGN_MEMBERS_MAX_COUNT)
  @IsUUID('all', { each: true })
  declare readonly membershipIds: string[];
}
