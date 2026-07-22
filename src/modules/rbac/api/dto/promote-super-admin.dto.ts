import { ApiProperty } from '@core/openapi';
import {
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  UUID_VERSION,
} from '@core/validation';

import {
  RBAC_REASON_MAX_LENGTH,
  RBAC_REASON_MIN_LENGTH,
} from '../../model/rbac.constants';

/** Promote a user to platform super administrator, with an audited reason. */
export class PromoteSuperAdminDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID(UUID_VERSION)
  declare readonly userId: string;

  @ApiProperty({
    minLength: RBAC_REASON_MIN_LENGTH,
    maxLength: RBAC_REASON_MAX_LENGTH,
    description: 'Mandatory audited justification for the promotion',
  })
  @IsString()
  @MinLength(RBAC_REASON_MIN_LENGTH)
  @MaxLength(RBAC_REASON_MAX_LENGTH)
  declare readonly reason: string;
}
