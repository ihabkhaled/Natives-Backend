import { ApiProperty } from '@core/openapi';

import { CompletionStatus } from '../../model/agendas.enums';

/** A station nested under an agenda block. */
export class StationResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly blockId: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly drillId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly groupId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly coachMembershipId: string | null;

  @ApiProperty()
  declare readonly position: number;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly repetitions: number | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly target: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly notes: string | null;

  @ApiProperty({ enum: CompletionStatus })
  declare readonly completionStatus: CompletionStatus;
}
