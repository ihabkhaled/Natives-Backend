import { ApiProperty } from '@core/openapi';

import {
  CompetitionStatus,
  CompetitionType,
} from '../../model/competitions.enums';

/** A competition with its lifecycle timestamps and optional metadata. */
export class CompetitionResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly competitionId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly seasonId: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ enum: CompetitionType })
  declare readonly competitionType: CompetitionType;

  @ApiProperty({ enum: CompetitionStatus })
  declare readonly status: CompetitionStatus;

  @ApiProperty({ type: String, nullable: true })
  declare readonly genderDivision: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly organizerName: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly externalRef: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  declare readonly startsOn: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  declare readonly endsOn: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly description: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly cancellationReason: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly publishedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly publishedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly activatedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly completedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly cancelledAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly archivedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
