/**
 * Single swap surface for the OpenAPI decorator vendor (@nestjs/swagger).
 * Controllers and DTOs import these re-exports — the vendor package itself is
 * importable only here and in bootstrap/ (document setup), ESLint-enforced.
 */
export {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  ApiUnauthorizedResponse,
  PartialType,
} from '@nestjs/swagger';
