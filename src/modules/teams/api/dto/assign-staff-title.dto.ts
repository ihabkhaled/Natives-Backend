import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsUrl, IsUUID, MaxLength } from '@core/validation';

import { PHOTO_URL_MAX_LENGTH } from '../../model/teams.constants';

export class AssignStaffTitleDto {
  @ApiProperty({ description: 'The membership to grant the staff title to' })
  @IsUUID()
  declare readonly membershipId: string;

  @ApiProperty({
    description: 'A staff_title reference-catalog entry id',
  })
  @IsUUID()
  declare readonly titleEntryId: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: PHOTO_URL_MAX_LENGTH,
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(PHOTO_URL_MAX_LENGTH)
  declare readonly photoUrl?: string;
}
