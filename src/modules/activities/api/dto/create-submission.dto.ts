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
  BUDDIES_MAX_ITEMS,
  DURATION_MAX_MINUTES,
  DURATION_MIN_MINUTES,
  EVIDENCE_MAX_ITEMS,
  ISO_DATE_PATTERN,
  NOTES_MAX_LENGTH,
  QUANTITY_MAX,
  QUANTITY_MIN,
} from '../../model/activities.constants';
import { SubmissionEvidenceDto } from './submission-evidence.dto';

/**
 * Request body to create a DRAFT external-training submission. The member and
 * team are taken from the token + route, never the body. Points are never
 * accepted from the client — a submission is a claim only.
 */
export class CreateSubmissionDto {
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

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BUDDIES_MAX_ITEMS)
  @IsUUID('all', { each: true })
  readonly buddyMembershipIds?: readonly string[];

  @ApiPropertyOptional({ type: [SubmissionEvidenceDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(EVIDENCE_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => SubmissionEvidenceDto)
  readonly evidence?: readonly SubmissionEvidenceDto[];
}
