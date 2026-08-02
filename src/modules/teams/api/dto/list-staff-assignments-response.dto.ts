import { ApiProperty } from '@core/openapi';

import { StaffAssignmentResponseDto } from './staff-assignment-response.dto';

export class ListStaffAssignmentsResponseDto {
  @ApiProperty({ type: [StaffAssignmentResponseDto] })
  declare readonly items: readonly StaffAssignmentResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
