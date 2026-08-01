import { ApiProperty } from '@core/openapi';

/** Confirmation that a contact submission was handed to the email transport. */
export class ContactResponseDto {
  @ApiProperty({ example: true, description: 'Always true on a 201' })
  declare readonly sent: boolean;
}
