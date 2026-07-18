import { ApiProperty } from '@core/openapi';

import { RoleAssignmentResponseDto } from './role-assignment-response.dto';

export class UserAssignmentsResponseDto {
  @ApiProperty()
  declare readonly userId: string;

  @ApiProperty({ type: [RoleAssignmentResponseDto] })
  declare readonly assignments: readonly RoleAssignmentResponseDto[];
}
