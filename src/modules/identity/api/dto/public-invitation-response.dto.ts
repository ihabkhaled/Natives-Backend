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
}
