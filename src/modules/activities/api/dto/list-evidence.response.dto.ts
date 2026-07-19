import { ApiProperty } from '@core/openapi';

import { EvidenceResponseDto } from './evidence-response.dto';

/** A bounded list of a submission's evidence (reviewer-scoped). */
export class ListEvidenceResponseDto {
  @ApiProperty({ type: [EvidenceResponseDto] })
  declare readonly items: readonly EvidenceResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
