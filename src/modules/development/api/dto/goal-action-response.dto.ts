import { ApiProperty } from '@core/openapi';

/** A single action-plan step in a goal detail response. */
export class GoalActionResponseDto {
  @ApiProperty()
  declare readonly description: string;

  @ApiProperty()
  declare readonly sortOrder: number;

  @ApiProperty()
  declare readonly done: boolean;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  declare readonly dueDate: string | null;
}
