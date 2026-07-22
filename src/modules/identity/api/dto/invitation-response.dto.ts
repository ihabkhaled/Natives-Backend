import { ApiProperty } from '@core/openapi';
import { Role } from '@shared/enums';

import { InvitationStatus } from '../../model/identity.enums';

export class InvitationResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly email: string;

  @ApiProperty({ enum: Role })
  declare readonly role: Role;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Team the invitee is onboarded into at acceptance; null for a platform-scoped invitation',
  })
  declare readonly teamId: string | null;

  @ApiProperty({
    example: 'coach',
    description: 'Team-role slug acceptance grants in the invited team',
  })
  declare readonly teamRole: string;

  @ApiProperty({ enum: InvitationStatus })
  declare readonly status: InvitationStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly expiresAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;
}
