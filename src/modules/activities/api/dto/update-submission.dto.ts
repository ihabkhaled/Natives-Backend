import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  Type,
  ValidateNested,
} from '@core/validation';

import {
  DURATION_MAX_MINUTES,
  DURATION_MIN_MINUTES,
  EVIDENCE_MAX_ITEMS,
  ISO_DATE_PATTERN,
  NOTES_MAX_LENGTH,
  QUANTITY_MAX,
  QUANTITY_MIN,
  RECORD_VERSION_MIN,
} from '../../model/activities.constants';
import { SubmissionEvidenceDto } from './submission-evidence.dto';

/**
 * Request body to edit an editable (draft or changes-requested) submission. The
 * evidence collection is replaced wholesale; buddies are fixed at creation. The
 * optimistic version guards against a concurrent edit.
 */
export class UpdateSubmissionDto {
  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly activityTypeId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string | null;

  @ApiProperty({ type: String, format: 'date' })
  @Matches(ISO_DATE_PATTERN)
  declare readonly performedOn: string;

  @ApiPropertyOptional({
    minimum: DURATION_MIN_MINUTES,
    maximum: DURATION_MAX_MINUTES,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(DURATION_MIN_MINUTES)
  @Max(DURATION_MAX_MINUTES)
  readonly durationMinutes?: number | null;

  @ApiPropertyOptional({
    minimum: QUANTITY_MIN,
    maximum: QUANTITY_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(QUANTITY_MIN)
  @Max(QUANTITY_MAX)
  readonly quantity?: number | null;

  @ApiPropertyOptional({ maxLength: NOTES_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NOTES_MAX_LENGTH)
  readonly notes?: string | null;

  @ApiPropertyOptional({ type: [SubmissionEvidenceDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(EVIDENCE_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => SubmissionEvidenceDto)
  readonly evidence?: readonly SubmissionEvidenceDto[];
}
