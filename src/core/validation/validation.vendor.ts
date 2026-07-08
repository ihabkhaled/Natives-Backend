/**
 * Single swap surface for the validation vendor (class-validator +
 * class-transformer). DTOs and config import these re-exports — never the
 * vendor packages directly (ESLint-enforced). Replacing the vendor means
 * updating only this file and the exception factory next to it.
 */
export { plainToInstance, Type } from 'class-transformer';
export {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';
