import { ApiProperty } from '@core/openapi';
import { IsUUID } from '@core/validation';

/** Request body to dry-run a rule against one member's live source facts. */
export class SimulateRuleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly membershipId: string;
}
