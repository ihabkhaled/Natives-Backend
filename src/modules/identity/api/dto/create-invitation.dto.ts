import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import { IsEmail, IsEnum, IsOptional, MaxLength } from '@core/validation';
import { Role } from '@shared/enums';

import { EMAIL_MAX_LENGTH } from '../../model/identity.constants';

export class CreateInvitationDto {
  @ApiProperty({ maxLength: EMAIL_MAX_LENGTH })
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  declare readonly email: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  declare readonly role?: Role;
}
