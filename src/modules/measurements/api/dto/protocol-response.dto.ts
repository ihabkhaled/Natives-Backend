import { ApiProperty } from '@core/openapi';

import {
  MeasurementDirection,
  MeasurementDiscipline,
  MeasurementUnit,
  ProtocolStatus,
  ResultPolicy,
} from '../../model/measurements.enums';

/** A measurement protocol definition with its unit, direction, and policy. */
export class ProtocolResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly teamId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty()
  declare readonly protocolKey: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly description: string | null;

  @ApiProperty({ enum: MeasurementDiscipline })
  declare readonly discipline: MeasurementDiscipline;

  @ApiProperty({ enum: MeasurementUnit })
  declare readonly unit: MeasurementUnit;

  @ApiProperty({ enum: MeasurementDirection })
  declare readonly direction: MeasurementDirection;

  @ApiProperty({ enum: ResultPolicy })
  declare readonly resultPolicy: ResultPolicy;

  @ApiProperty({ type: String, nullable: true })
  declare readonly instructions: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly safetyNotes: string | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly minValue: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly maxValue: number | null;

  @ApiProperty({ enum: ProtocolStatus })
  declare readonly status: ProtocolStatus;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
