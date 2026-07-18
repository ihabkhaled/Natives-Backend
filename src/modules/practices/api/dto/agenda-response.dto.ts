import { ApiProperty } from '@core/openapi';

import { AgendaStatus } from '../../model/agendas.enums';
import { BlockResponseDto } from './block-response.dto';
import { GroupResponseDto } from './group-response.dto';

/**
 * The full agenda tree for a session (blocks → stations, plus participant groups).
 * When no agenda exists yet, `agendaId`/`status`/`version` are null and the arrays
 * are empty. Private coach notes appear only on the coach plan (drill.manage).
 */
export class AgendaResponseDto {
  @ApiProperty()
  declare readonly sessionId: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly agendaId: string | null;

  @ApiProperty({ enum: AgendaStatus, nullable: true })
  declare readonly status: AgendaStatus | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly theme: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly notes: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly publishedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly completedAt: Date | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly version: number | null;

  @ApiProperty({ type: [BlockResponseDto] })
  declare readonly blocks: readonly BlockResponseDto[];

  @ApiProperty({ type: [GroupResponseDto] })
  declare readonly groups: readonly GroupResponseDto[];
}
