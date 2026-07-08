import { ApiProperty } from '@core/openapi';
import { IsEmail, IsString, MinLength } from '@core/validation';

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  readonly email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  readonly password!: string;
}
