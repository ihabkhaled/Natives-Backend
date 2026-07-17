/**
 * Single swap surface for the validation vendor (class-validator +
 * class-transformer). DTOs and config import these re-exports — never the
 * vendor packages directly (ESLint-enforced). Replacing the vendor means
 * updating only this file and the exception factory next to it.
 */
export {
  Exclude,
  Expose,
  plainToInstance,
  Transform,
  Type,
} from 'class-transformer';
export {
  ArrayMaxSize,
  IsArray,
  IsByteLength,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  validateSync,
} from 'class-validator';
