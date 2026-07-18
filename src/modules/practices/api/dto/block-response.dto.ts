import { ApiProperty } from '@core/openapi';

import {
  AgendaBlockType,
  CompletionStatus,
  DrillIntensity,
} from '../../model/agendas.enums';
import { StationResponseDto } from './station-response.dto';

/**
 * An ordered agenda block with its nested stations. `coachNotes` is null on the
 * broad read and populated only on the coach plan (drill.manage) — field-level
 * shaping keeps private notes out of team-wide reads and exports.
 */
export class BlockResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly drillId: string | null;

  @ApiProperty()
  declare readonly position: number;

  @ApiProperty()
  declare readonly title: string;

  @ApiProperty({ enum: AgendaBlockType })
  declare readonly blockType: AgendaBlockType;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly offsetMinutes: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly durationMinutes: number | null;

  @ApiProperty({ enum: DrillIntensity, nullable: true })
  declare readonly intensity: DrillIntensity | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly repetitions: number | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly target: string | null;

  @ApiProperty({ enum: CompletionStatus })
  declare readonly completionStatus: CompletionStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly completedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly notes: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly coachNotes: string | null;

  @ApiProperty({ type: [StationResponseDto] })
  declare readonly stations: readonly StationResponseDto[];
}
