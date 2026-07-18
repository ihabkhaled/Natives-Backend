import { ApiProperty } from '@core/openapi';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  Type,
  ValidateNested,
} from '@core/validation';

import { BULK_MARKS_MAX_COUNT } from '../../model/attendance.constants';
import { BulkMarkEntryDto } from './bulk-mark-entry.dto';

/**
 * Body for an atomic bulk attendance mark (roster prefill + bulk mark). The list is
 * bounded and non-empty; every entry is validated before any row is written, so
 * partial failures are impossible — the whole batch commits or none of it does.
 */
export class BulkMarkAttendanceDto {
  @ApiProperty({ type: [BulkMarkEntryDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(BULK_MARKS_MAX_COUNT)
  @ValidateNested({ each: true })
  @Type(() => BulkMarkEntryDto)
  declare readonly marks: readonly BulkMarkEntryDto[];
}
