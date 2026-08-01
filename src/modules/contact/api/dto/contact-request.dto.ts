import { ApiProperty } from '@core/openapi';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
  Transform,
} from '@core/validation';

import {
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_MESSAGE_MIN_LENGTH,
  CONTACT_SUBJECT_MAX_LENGTH,
  CONTACT_SUBJECT_MIN_LENGTH,
} from '../../model/contact.constants';

function trim({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * A public contact-form submission. The global validation pipe strips and
 * rejects unknown properties, so a caller cannot smuggle extra header-shaped
 * fields. Subject and message are trimmed before length validation.
 */
export class ContactRequestDto {
  @ApiProperty({ maxLength: CONTACT_EMAIL_MAX_LENGTH })
  @IsEmail()
  @MaxLength(CONTACT_EMAIL_MAX_LENGTH)
  declare readonly email: string;

  @ApiProperty({
    minLength: CONTACT_SUBJECT_MIN_LENGTH,
    maxLength: CONTACT_SUBJECT_MAX_LENGTH,
  })
  @Transform(trim)
  @IsString()
  @MinLength(CONTACT_SUBJECT_MIN_LENGTH)
  @MaxLength(CONTACT_SUBJECT_MAX_LENGTH)
  declare readonly subject: string;

  @ApiProperty({
    minLength: CONTACT_MESSAGE_MIN_LENGTH,
    maxLength: CONTACT_MESSAGE_MAX_LENGTH,
  })
  @Transform(trim)
  @IsString()
  @MinLength(CONTACT_MESSAGE_MIN_LENGTH)
  @MaxLength(CONTACT_MESSAGE_MAX_LENGTH)
  declare readonly message: string;
}
