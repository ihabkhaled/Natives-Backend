import { ApiProperty } from '@core/openapi';
import { IsInt, Min } from '@core/validation';

import { VERSION_MIN } from '../../model/assessments.constants';

export class PublishTemplateDto {
  @ApiProperty({ minimum: VERSION_MIN })
  @IsInt()
  @Min(VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}
