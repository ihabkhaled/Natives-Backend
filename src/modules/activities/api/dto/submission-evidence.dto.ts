import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from '@core/validation';

import {
  EVIDENCE_BYTE_SIZE_MAX,
  EVIDENCE_BYTE_SIZE_MIN,
  EVIDENCE_CONTENT_TYPE_MAX_LENGTH,
  EVIDENCE_DESCRIPTION_MAX_LENGTH,
  EVIDENCE_REFERENCE_MAX_LENGTH,
} from '../../model/activities.constants';
import { EVIDENCE_KIND_VALUES, EvidenceKind } from '../../model/activity.enums';

/**
 * One evidence attachment: metadata + a PRIVATE storage reference only. No bytes
 * are uploaded here — the reference points at privately-stored evidence that only
 * reviewers can read.
 */
export class SubmissionEvidenceDto {
  @ApiProperty({ enum: EVIDENCE_KIND_VALUES })
  @IsEnum(EvidenceKind)
  declare readonly kind: EvidenceKind;

  @ApiProperty({ maxLength: EVIDENCE_REFERENCE_MAX_LENGTH })
  @IsString()
  @MaxLength(EVIDENCE_REFERENCE_MAX_LENGTH)
  declare readonly storageReference: string;

  @ApiPropertyOptional({
    maxLength: EVIDENCE_CONTENT_TYPE_MAX_LENGTH,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(EVIDENCE_CONTENT_TYPE_MAX_LENGTH)
  readonly contentType?: string | null;

  @ApiPropertyOptional({
    minimum: EVIDENCE_BYTE_SIZE_MIN,
    maximum: EVIDENCE_BYTE_SIZE_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(EVIDENCE_BYTE_SIZE_MIN)
  @Max(EVIDENCE_BYTE_SIZE_MAX)
  readonly byteSize?: number | null;

  @ApiPropertyOptional({
    maxLength: EVIDENCE_DESCRIPTION_MAX_LENGTH,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(EVIDENCE_DESCRIPTION_MAX_LENGTH)
  readonly description?: string | null;
}
