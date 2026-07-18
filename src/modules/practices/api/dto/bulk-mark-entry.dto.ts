import { ApiProperty } from '@core/openapi';
import { IsUUID } from '@core/validation';

import { AttendanceMarkDto } from './attendance-mark.dto';

/**
 * One entry in a bulk attendance mark: a target membership plus its mark fields.
 * The membership must belong to the team scope; the whole batch is applied
 * atomically so an invalid entry rolls the entire request back.
 */
export class BulkMarkEntryDto extends AttendanceMarkDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly membershipId: string;
}
