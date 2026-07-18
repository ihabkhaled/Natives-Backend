import { ApiProperty } from '@core/openapi';

import {
  DrillCategory,
  DrillIntensity,
  DrillStatus,
} from '../../model/agendas.enums';

/** A catalog drill projection. Free-text fields are null when unspecified. */
export class DrillResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ enum: DrillCategory })
  declare readonly category: DrillCategory;

  @ApiProperty({ type: String, nullable: true })
  declare readonly objective: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly instructions: string | null;

  @ApiProperty({ type: [String] })
  declare readonly equipment: readonly string[];

  @ApiProperty({ enum: DrillIntensity })
  declare readonly intensity: DrillIntensity;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly defaultDurationMinutes: number | null;

  @ApiProperty({ type: [String] })
  declare readonly skillTags: readonly string[];

  @ApiProperty({ type: String, nullable: true })
  declare readonly safetyNotes: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly mediaUrl: string | null;

  @ApiProperty({ enum: DrillStatus })
  declare readonly status: DrillStatus;

  @ApiProperty()
  declare readonly version: number;
}
