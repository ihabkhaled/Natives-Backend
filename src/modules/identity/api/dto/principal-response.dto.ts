import { ApiProperty } from '@core/openapi';
import { Role } from '@shared/enums';

import { UserStatus } from '../../model/identity.enums';

export class PrincipalResponseDto {
  @ApiProperty()
  declare readonly userId: string;

  @ApiProperty()
  declare readonly email: string;

  @ApiProperty({ enum: Role })
  declare readonly role: Role;

  @ApiProperty({ enum: UserStatus })
  declare readonly status: UserStatus;
}
