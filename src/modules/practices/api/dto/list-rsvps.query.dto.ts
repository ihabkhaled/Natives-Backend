import { ApiPropertyOptional } from '@core/openapi';
import { IsEnum, IsOptional } from '@core/validation';

import { RsvpStatus } from '../../model/rsvp.enums';
import { PracticeListQueryDto } from './list-query.dto';

/**
 * Filter for the participant list. Status is the only allowlisted dimension;
 * pagination is inherited and clamped.
 */
export class ListRsvpsQueryDto extends PracticeListQueryDto {
  @ApiPropertyOptional({ enum: RsvpStatus })
  @IsOptional()
  @IsEnum(RsvpStatus)
  readonly status?: RsvpStatus;
}
