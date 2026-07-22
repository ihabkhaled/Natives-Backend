import { ApiProperty } from '@core/openapi';
import { IsString, MaxLength, MinLength } from '@core/validation';

import {
  RBAC_REASON_MAX_LENGTH,
  RBAC_REASON_MIN_LENGTH,
} from '../../model/rbac.constants';

/** Revoke a platform super administrator, with an audited reason. */
export class RevokeSuperAdminDto {
  @ApiProperty({
    minLength: RBAC_REASON_MIN_LENGTH,
    maxLength: RBAC_REASON_MAX_LENGTH,
    description: 'Mandatory audited justification for the revocation',
  })
  @IsString()
  @MinLength(RBAC_REASON_MIN_LENGTH)
  @MaxLength(RBAC_REASON_MAX_LENGTH)
  declare readonly reason: string;
}
