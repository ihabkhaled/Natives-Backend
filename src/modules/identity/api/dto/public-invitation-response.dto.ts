import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import { Role } from '@shared/enums';

export class PublicInvitationResponseDto {
  @ApiProperty()
  declare readonly email: string;

  @ApiProperty({ enum: Role })
  declare readonly role: Role;

  @ApiPropertyOptional({ nullable: true })
  declare readonly inviterName: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly expiresAt: Date;

  @ApiProperty({
    example: 'coach',
    description: 'Team-role slug acceptance grants in the invited team',
  })
  declare readonly teamRole: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly teamId: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Invited team display name for accept-page confirmation',
  })
  declare readonly teamName: string | null;
}
