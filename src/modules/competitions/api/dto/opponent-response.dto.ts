import { ApiProperty } from '@core/openapi';

import { OpponentStatus } from '../../model/competitions.enums';

/** An opponent-catalogue entry (an external team the team plays). */
export class OpponentResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly opponentId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly shortName: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly logoRef: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly contactName: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly contactInfo: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly notes: string | null;

  @ApiProperty({ enum: OpponentStatus })
  declare readonly status: OpponentStatus;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
