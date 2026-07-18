import { ApiProperty } from '@core/openapi';

import { AgendaStatus } from '../../model/agendas.enums';

/** Lightweight agenda acknowledgement returned by lifecycle writes (no tree). */
export class AgendaSummaryResponseDto {
  @ApiProperty()
  declare readonly sessionId: string;

  @ApiProperty()
  declare readonly agendaId: string;

  @ApiProperty({ enum: AgendaStatus })
  declare readonly status: AgendaStatus;

  @ApiProperty({ type: String, nullable: true })
  declare readonly theme: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly notes: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly publishedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly completedAt: Date | null;

  @ApiProperty()
  declare readonly version: number;
}
