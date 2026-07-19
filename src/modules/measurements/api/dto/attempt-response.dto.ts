import { ApiProperty } from '@core/openapi';

import { MeasurementUnit } from '../../model/measurements.enums';

/** One immutable recorded attempt (raw + canonical value; null-not-zero). */
export class AttemptResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly sessionId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly protocolId: string;

  @ApiProperty()
  declare readonly attemptNumber: number;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly rawValue: number | null;

  @ApiProperty({ enum: MeasurementUnit })
  declare readonly unit: MeasurementUnit;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly canonicalValue: number | null;

  @ApiProperty()
  declare readonly valid: boolean;

  @ApiProperty()
  declare readonly disqualified: boolean;

  @ApiProperty({ type: String, nullable: true })
  declare readonly dqReason: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly evaluatorUserId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly notes: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly recordedAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;
}
