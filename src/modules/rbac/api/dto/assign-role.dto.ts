import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  UUID_VERSION,
} from '@core/validation';
import { RbacRole } from '@shared/enums';

export class AssignRoleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID(UUID_VERSION)
  declare readonly userId: string;

  @ApiProperty({ enum: RbacRole })
  @IsEnum(RbacRole)
  declare readonly roleKey: RbacRole;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  declare readonly effectiveTo?: string;
}
