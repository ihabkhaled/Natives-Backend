# Skill: Add a Request/Response DTO with Validation

> Playbook for adding a validated HTTP boundary DTO — class-validator (primary) wired through the global `ValidationPipe`, with the Zod-pipe alternative. Implements [05-dto-and-validation.md](../rules/05-dto-and-validation.md) and the canon in [/context/architecture-map.md](../context/architecture-map.md).

Every value entering the app from outside the type system (body, params, query, headers, files, webhooks, integration responses) is parsed by a DTO **before** the controller delegates. The DTO is the only shape the application layer receives. Identity never comes from the body.

---

## Rules this skill enforces

- **Validate every boundary** with a DTO; nothing untrusted reaches a service (rule 25).
- DTO class/schema + its type live in `api/dto/<name>.dto.ts` — **never inline** in controllers/services/repositories/use-cases (rules 10–16).
- **Bound everything**: every string `@MaxLength`, every array `@ArrayMaxSize`, every list `limit` capped at **100** (rules 9, 37).
- **Whitelist** sortable fields and enum filters — enums via `@IsEnum` / `z.nativeEnum`, never raw string unions (rules 8, 9).
- Each validation rule's message **is** an `errors.<feature>.<key>` i18n key (rule 26).
- Validation lives in the DTO, not the service; business invariants live in `domain/`.

---

## Step 1 — Name the DTO and put constants/enums in their files first

Bounds and whitelisted values are constants/enums — they must already exist in `model/` (or `@shared`), never inline (rules 8, 12, 13). Create or reuse them before the DTO.

```ts
// model/<feature>.constants.ts
export const FEATURE_TITLE_MAX = 200;
export const FEATURE_TAGS_MAX = 20;
```

```ts
// model/<feature>.enums.ts  (each enum also exported with a *_VALUES array — see rules/06)
export enum FeatureVisibility {
  Private = 'private',
  Public = 'public',
}
export enum FeatureSortField {
  CreatedAt = 'createdAt',
  Title = 'title',
}
```

| Artifact | File → Class | Example |
| --- | --- | --- |
| Create | `create-<feature>.dto.ts` → `Create<Feature>Dto` | `CreateArticleDto` |
| Update | `update-<feature>.dto.ts` → `Update<Feature>Dto` | `UpdateArticleDto` |
| Query | `list-<feature>-query.dto.ts` → `List<Feature>QueryDto` | `ListArticleQueryDto` |
| Response | `<feature>-response.dto.ts` → `<Feature>ResponseDto` | `ArticleResponseDto` |

## Step 2 — Write the Create DTO (PRIMARY: class-validator)

Bound every string and array. Enums via `@IsEnum`. Coerce numbers with explicit `@Type`. Each rule carries a `messageKey`. `@ApiProperty` documents the OpenAPI contract.

```ts
// api/dto/create-<feature>.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { FeatureVisibility } from '@modules/feature/model/feature.enums';
import { FEATURE_TAGS_MAX, FEATURE_TITLE_MAX } from '@modules/feature/model/feature.constants';

export class CreateFeatureDto {
  @ApiProperty({ maxLength: FEATURE_TITLE_MAX })
  @IsString({ message: 'errors.feature.title.invalid' })
  @MaxLength(FEATURE_TITLE_MAX, { message: 'errors.feature.title.maxLength' })
  readonly title!: string;

  @ApiProperty({ enum: FeatureVisibility })
  @IsEnum(FeatureVisibility, { message: 'errors.feature.visibility.invalid' })
  readonly visibility!: FeatureVisibility;

  @ApiPropertyOptional({ type: [String], maxItems: FEATURE_TAGS_MAX })
  @IsOptional()
  @IsArray({ message: 'errors.feature.tags.invalid' })
  @ArrayMaxSize(FEATURE_TAGS_MAX, { message: 'errors.feature.tags.maxItems' })
  @IsString({ each: true, message: 'errors.feature.tags.invalid' })
  readonly tags?: string[];
}
```

```ts
// Don't — inline shape in the controller (banned by ESLint no-restricted-syntax)
@Post()
create(@Body() body: { title: string }): Promise<FeatureResponseDto> { /* ... */ }
```

## Step 3 — Derive the Update DTO; never re-declare

`PartialType` keeps every decorator (and its `messageKey`) in one place and makes all fields optional.

```ts
// api/dto/update-<feature>.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateFeatureDto } from '@modules/feature/api/dto/create-feature.dto';

export class UpdateFeatureDto extends PartialType(CreateFeatureDto) {}
```

## Step 4 — Query DTO: bound, coerce, whitelist (rules 9, 37)

Query values arrive as strings. Coerce with `@Type`, cap `limit` at the shared max (hard cap **100**), and whitelist `sortBy` with an enum — never a free string (that flows straight into `ORDER BY` = identifier injection; see [08-database-and-injection-safety.md](../rules/08-database-and-injection-safety.md)).

```ts
// api/dto/list-<feature>-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { FeatureSortField, FeatureVisibility } from '@modules/feature/model/feature.enums';
import { SortDirection } from '@shared/enums';
import { LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX, LIST_PAGE_DEFAULT } from '@shared/constants';

export class ListFeatureQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: LIST_PAGE_DEFAULT })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  readonly page: number = LIST_PAGE_DEFAULT;

  @ApiPropertyOptional({ minimum: 1, maximum: LIST_LIMIT_MAX })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(LIST_LIMIT_MAX)
  readonly limit: number = LIST_LIMIT_DEFAULT;

  @ApiPropertyOptional({ enum: FeatureSortField })
  @IsOptional() @IsEnum(FeatureSortField, { message: 'errors.feature.sortBy.invalid' })
  readonly sortBy: FeatureSortField = FeatureSortField.CreatedAt;

  @ApiPropertyOptional({ enum: SortDirection })
  @IsOptional() @IsEnum(SortDirection)
  readonly sortDirection: SortDirection = SortDirection.Desc;

  @ApiPropertyOptional({ enum: FeatureVisibility })
  @IsOptional() @IsEnum(FeatureVisibility)
  readonly visibility?: FeatureVisibility;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional() @IsString() @MaxLength(200)
  readonly search?: string;
}
```

## Step 5 — Response DTO: expose a stable contract, never the entity

Return a `<Feature>ResponseDto` shaped by a mapper in `lib/<feature>.mappers.ts` (see [06-types-enums-constants.md](../rules/06-types-enums-constants.md)). `@Exclude()` by default so internal columns and secrets never leak.

```ts
// api/dto/<feature>-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { FeatureVisibility } from '@modules/feature/model/feature.enums';

@Exclude()
export class FeatureResponseDto {
  @Expose() @ApiProperty() readonly id!: string;
  @Expose() @ApiProperty() readonly title!: string;
  @Expose() @ApiProperty({ enum: FeatureVisibility }) readonly visibility!: FeatureVisibility;
  @Expose() @ApiProperty() readonly createdAt!: string;
}
```

## Step 6 — Confirm the global `ValidationPipe` is wired (once, in bootstrap)

Validation is configured one time, not per controller. These flags are non-negotiable; do not weaken them for a single endpoint.

```ts
// bootstrap/bootstrap.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,            // strip undecorated properties
    forbidNonWhitelisted: true, // reject unknown properties (closes mass-assignment)
    transform: true,            // produce real DTO instances
    transformOptions: { enableImplicitConversion: false }, // coerce only via explicit @Type
    stopAtFirstError: false,    // collect every field error
  }),
);
```

## Step 7 — Consume the DTO in the thin controller

The DTO is the only thing handed to the application method. Identity comes from `@CurrentUser()` (verified token), never the body. One delegation per method (`architecture/controller-no-logic`).

```ts
// api/<feature>.controller.ts
@Post()
create(@CurrentUser() user: AuthUser, @Body() dto: CreateFeatureDto): Promise<FeatureResponseDto> {
  return this.featureService.create(user.id, dto);
}
```

## Step 8 (alternative) — Zod via a `ZodValidationPipe`

If the project chose Zod as its single-source-of-truth validator (`z.infer`), keep the schema and its type together in `api/dto/`, bound every `z.string().max()` / `z.array().max()`, and apply per-argument. The pipe throws a typed `AppError`, never a raw `BadRequestException` — the global filter owns the response shape. Pick one validator per project; do not mix per endpoint.

```ts
// api/dto/create-<feature>.dto.ts  (Zod variant)
import { z } from 'zod';
import { FeatureVisibility } from '@modules/feature/model/feature.enums';
import { FEATURE_TITLE_MAX } from '@modules/feature/model/feature.constants';

export const createFeatureSchema = z.object({
  title: z.string({ message: 'errors.feature.title.required' }).max(FEATURE_TITLE_MAX, 'errors.feature.title.maxLength'),
  visibility: z.nativeEnum(FeatureVisibility, { message: 'errors.feature.visibility.invalid' }),
});
export type CreateFeatureDto = z.infer<typeof createFeatureSchema>;
```

```ts
// api/<feature>.controller.ts  (Zod variant)
@Post()
create(@Body(new ZodValidationPipe(createFeatureSchema)) dto: CreateFeatureDto): Promise<FeatureResponseDto> {
  return this.featureService.create(dto);
}
```

## Step 9 — Add the message keys for every supported locale

Each new `errors.<feature>.<key>` must exist in **every supported locale** before the DTO is done. Cover each branch (required, type, min, max, format, custom). See [add-i18n-message-key.md](./add-i18n-message-key.md) and [16-i18n-and-messaging.md](../rules/16-i18n-and-messaging.md).

---

## Tests FIRST

Write the DTO test before the DTO. Validate by running the DTO through the same pipe the app uses (`new ValidationPipe(...).transform(plainToInstance(...))`, or the Zod schema's `safeParse`). Assert:

- valid input passes and yields a real DTO instance;
- each invalid field rejects with the expected `errors.<feature>.<key>`;
- defaults apply; `limit` caps at 100; unknown `sortBy`/enum values are rejected;
- `forbidNonWhitelisted` rejects unexpected properties;
- cross-field `.refine()` / custom-validator rules are covered.

Response-mapping logic is covered in the mapper's unit test. Keep coverage ≥ 95% on touched files (see [write-unit-tests.md](./write-unit-tests.md) and [11-testing-and-coverage.md](../rules/11-testing-and-coverage.md)). When a route changed, add an integration test ([write-integration-tests.md](./write-integration-tests.md)).

---

## Quality gates

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
```

All five must pass. Never bypass Husky hooks with `--no-verify`.

---

## Pitfalls

- **Free-form `sortBy: string`** flows into `ORDER BY` → SQL identifier injection. Whitelist with an enum + a constants→column map (Step 4).
- **Unbounded strings/arrays/`limit`.** Every `@IsString` needs `@MaxLength`; every `@IsArray` needs `@ArrayMaxSize`; `limit` caps at 100 (rules 9, 37).
- **English prose in `message`.** It leaks to the client and cannot be translated — use the `messageKey` (Step 9).
- **Re-declaring the Update DTO** instead of `PartialType` ⇒ decorators drift between create and update.
- **Reading identity from the body.** Use `@CurrentUser()` from the verified token.
- **Returning the entity** instead of a Response DTO ⇒ internal columns/secrets leak. Map via `lib/` and `@Exclude`/`@Expose`.
- **Weakening pipe flags** for one endpoint (dropping `forbidNonWhitelisted`) reopens mass-assignment.
- **`enableImplicitConversion: true`** hides coercion — coerce deliberately with `@Type(() => Number)`.
- **Unsafe regex (ReDoS).** No nested quantifiers; split a simple regex from a `.refine()`/custom validator for the complex part.
- **Re-validating shape in the service.** Shape belongs in the DTO; invariants belong in `domain/`.

---

## Related

[05-dto-and-validation.md](../rules/05-dto-and-validation.md) · [02-controllers-and-http-transport.md](../rules/02-controllers-and-http-transport.md) · [06-types-enums-constants.md](../rules/06-types-enums-constants.md) · [create-controller.md](./create-controller.md) · [create-service.md](./create-service.md) · [create-error.md](./create-error.md) · [add-i18n-message-key.md](./add-i18n-message-key.md) · [write-unit-tests.md](./write-unit-tests.md) · [/context/architecture-map.md](../context/architecture-map.md) · [skills index](./README.md)
