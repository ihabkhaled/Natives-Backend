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

  @ApiProperty({ enum: InvitationStatus })
  declare readonly status: InvitationStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly expiresAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;
}
