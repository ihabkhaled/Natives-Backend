import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  Matches,
  MaxLength,
} from '@core/validation';
import { ROLE_SLUG_MAX_LENGTH, ROLE_SLUG_PATTERN } from '@modules/rbac';
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

  /**
   * Team role slug from the assignable catalog; shape-only validation here —
   * RBAC resolves it against the open catalog and the actor's ceiling inside
   * the transaction. Default: member.
   */
  @ApiPropertyOptional({
    example: 'coach',
    pattern: '^[a-z][a-z0-9_]*$',
    maxLength: ROLE_SLUG_MAX_LENGTH,
  })
  @IsOptional()
  @Matches(ROLE_SLUG_PATTERN)
  @MaxLength(ROLE_SLUG_MAX_LENGTH)
  declare readonly teamRole?: string;
}
