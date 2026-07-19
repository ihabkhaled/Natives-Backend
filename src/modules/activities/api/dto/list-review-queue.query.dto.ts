import { ApiPropertyOptional } from '@core/openapi';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  Type,
} from '@core/validation';

import {
  LIST_MAX_LIMIT,
  LIST_MIN_LIMIT,
  REVIEW_QUEUE_FILTERABLE_STATUSES,
} from '../../model/activities.constants';
import type { SubmissionStatus } from '../../model/activity.enums';

/**
 * Bounded, allowlisted reviewer-queue filter. `status` may only narrow to an
 * allowlisted review state (never drafts or withdrawn claims); the type/member
 * filters are optional uuids. Ordering is fixed server-side (oldest first).
 */
export class ListReviewQueueQueryDto {
  @ApiPropertyOptional({ minimum: LIST_MIN_LIMIT, maximum: LIST_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(LIST_MIN_LIMIT)
  @Max(LIST_MAX_LIMIT)
  readonly limit?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly offset?: number;

  @ApiPropertyOptional({ enum: REVIEW_QUEUE_FILTERABLE_STATUSES })
  @IsOptional()
  @IsIn([...REVIEW_QUEUE_FILTERABLE_STATUSES])
  readonly status?: SubmissionStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly activityTypeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly membershipId?: string;
}
