import { ApiProperty } from '@core/openapi';

import {
  EVIDENCE_KIND_VALUES,
  EVIDENCE_SCAN_STATUS_VALUES,
  type EvidenceKind,
  type EvidenceScanStatus,
} from '../../model/activity.enums';

/**
 * Reviewer-only evidence projection. Carries the PRIVATE storage reference and is
 * returned exclusively to holders of evidence.read.review.
 */
export class EvidenceResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly submissionId: string;

  @ApiProperty({ enum: EVIDENCE_KIND_VALUES })
  declare readonly kind: EvidenceKind;

  @ApiProperty()
  declare readonly storageReference: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly contentType: string | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly byteSize: number | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly description: string | null;

  @ApiProperty({ enum: EVIDENCE_SCAN_STATUS_VALUES })
  declare readonly scanStatus: EvidenceScanStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: string;
}
