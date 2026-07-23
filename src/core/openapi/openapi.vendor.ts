/**
 * Single swap surface for the OpenAPI decorator vendor (@nestjs/swagger).
 * Controllers and DTOs import these re-exports — the vendor package itself is
 * importable only here and in bootstrap/ (document setup), ESLint-enforced.
 */
export {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
  PartialType,
} from '@nestjs/swagger';
