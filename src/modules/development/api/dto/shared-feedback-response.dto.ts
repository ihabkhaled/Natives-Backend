import { ApiProperty } from '@core/openapi';

import { FeedbackStatus } from '../../model/feedback.enums';

/**
 * A published feedback shaped for the assessed member. It structurally cannot
 * carry the coach note — the property does not exist — so a private observation
 * can never reach a self view.
 */
export class SharedFeedbackResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly id: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ enum: FeedbackStatus })
  declare readonly status: FeedbackStatus;

  @ApiProperty()
  declare readonly revision: number;

  @ApiProperty({ type: String, nullable: true })
  declare readonly positiveFrisbee: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly frisbeeImprovement: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly positiveMental: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly mentalImprovement: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly teamRole: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly recommendedPosition: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly summary: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly publishedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly acknowledgedAt: Date | null;

  @ApiProperty()
  declare readonly clarificationRequested: boolean;
}
