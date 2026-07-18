import { ApiProperty } from '@core/openapi';
import { RbacRole } from '@shared/enums';

export class RoleAssignmentResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly userId: string;

  @ApiProperty({ enum: RbacRole })
  declare readonly roleKey: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly teamId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly effectiveFrom: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly effectiveTo: Date | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly grantedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly revokedAt: Date | null;

  @ApiProperty()
  declare readonly version: number;
}
