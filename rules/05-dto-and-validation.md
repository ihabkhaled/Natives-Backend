# 05 — Boundary DTOs & Validation

> Validate **every** HTTP boundary with a DTO before it reaches the application layer. **class-validator + class-transformer** is PRIMARY, wired through the global `ValidationPipe`; **Zod via a `ZodValidationPipe`** is the documented alternative. DTOs live only in `api/dto/` — never inline. This implements rules **10–16** (no inline DTOs), **25** (all boundary validation via DTOs), and **26** (typed `messageKey`s) from [00-non-negotiable-rules.md](./00-non-negotiable-rules.md).

Related: [02-controllers-and-http-transport.md](./02-controllers-and-http-transport.md) · [04-repositories-and-persistence.md](./04-repositories-and-persistence.md) · [06-types-enums-constants.md](./06-types-enums-constants.md) · [16-i18n-and-messaging.md](./16-i18n-and-messaging.md) · [18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md) · canon [/context/architecture-map.md](../context/architecture-map.md).

---

## 1. Validate every boundary — nothing untrusted reaches a service

A **boundary** is anything entering the app from outside the type system. Each one is parsed and shaped by a DTO before the controller delegates:

| Boundary                                     | How it is validated                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Request **body**                             | `@Body() dto: CreateXDto` — DTO class with decorators                                                                                       |
| Route **params** (`:id`)                     | `@Param() params: XParamsDto` (UUID/format checks) — never trust a raw `id` string                                                          |
| **Query** string (filters, sort, pagination) | `@Query() query: ListXQueryDto` — coerce + bound + whitelist                                                                                |
| **Headers** read as data                     | a dedicated header DTO                                                                                                                      |
| Uploaded **files**                           | MIME / extension / size checks (see [07-security-authn-authz.md](./07-security-authn-authz.md))                                             |
| Inbound **webhooks**                         | a DTO in the integration module's `api/dto/` — payloads are attacker-controlled                                                             |
| External **integration responses**           | parse before trusting — a vendor can change its contract (see [12-library-wrapping-and-adapters.md](./12-library-wrapping-and-adapters.md)) |

The DTO is the only thing the controller hands to the application method. Identity is **never** taken from the body — it comes from the verified token via `@CurrentUser()` (see [07-security-authn-authz.md](./07-security-authn-authz.md)).

---

## 2. DTOs live in `api/dto/` only — never inline (rules 10–16)

Every DTO class lives in `src/modules/<feature>/api/dto/<name>.dto.ts`. Defining a class, type, interface, or anonymous request shape inline in a controller, service, use case, or repository is banned by the architecture plugin. Decorated DTO properties use `declare readonly`; a definite-assignment assertion (`!`) is still an assertion and is forbidden by rules 7 and 47.

```ts
// Do — in api/dto/create-article.dto.ts
export class CreateArticleDto {
  @ApiProperty({ maxLength: ARTICLE_TITLE_MAX })
  @IsString()
  @MaxLength(ARTICLE_TITLE_MAX, { message: 'errors.article.title.maxLength' })
  declare readonly title: string;
}
```

```ts
// Don't — DTO/shape declared inside the controller
@Post()
create(@Body() body: { title: string }) { /* inline shape = banned */ }
```

### File naming

| Artifact     | Convention                                              | Example               |
| ------------ | ------------------------------------------------------- | --------------------- |
| Create DTO   | `create-<feature>.dto.ts` → `Create<Feature>Dto`        | `CreateArticleDto`    |
| Update DTO   | `update-<feature>.dto.ts` → `Update<Feature>Dto`        | `UpdateArticleDto`    |
| Query DTO    | `list-<feature>-query.dto.ts` → `List<Feature>QueryDto` | `ListArticleQueryDto` |
| Action DTO   | `<action>.dto.ts` → `<Action>Dto`                       | `PublishArticleDto`   |
| Response DTO | `<feature>-response.dto.ts` → `<Feature>ResponseDto`    | `ArticleResponseDto`  |

---

## 3. Global ValidationPipe — the one place the policy is wired

Validation is configured **once** in `bootstrap/`, not per-controller. These flags are non-negotiable.

```ts
// bootstrap/bootstrap.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // strip properties with no decorator
    forbidNonWhitelisted: true, // reject unknown properties (no silent extras)
    transform: true, // produce real DTO instances
    transformOptions: { enableImplicitConversion: false }, // explicit @Type only
    stopAtFirstError: false, // collect every field error
  }),
);
```

- `whitelist + forbidNonWhitelisted` are mandatory — they close mass-assignment and unexpected-field holes.
- Keep `enableImplicitConversion: false`; coerce deliberately with `@Type(() => Number)` so behavior is visible in the DTO, not implicit.
- The pipe's failure is mapped by the global exception filter to a sanitized body (see §7 and [18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md)).

---

## 4. Create / Update / Response DTOs (PRIMARY: class-validator)

Bound **every** string (`@MaxLength`) and **every** array (`@ArrayMaxSize`). Use enums via `@IsEnum`, never raw string unions. Each rule carries a `messageKey`. `@ApiProperty` documents the contract for OpenAPI.

```ts
// api/dto/create-article.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Type,
} from '@core/validation';
import { ArticleVisibility } from '@modules/article/model/article.enums';
import {
  ARTICLE_BODY_MAX,
  ARTICLE_TAGS_MAX,
  ARTICLE_TITLE_MAX,
} from '@modules/article/model/article.constants';

export class CreateArticleDto {
  @ApiProperty({ maxLength: ARTICLE_TITLE_MAX })
  @IsString({ message: 'errors.article.title.invalid' })
  @MaxLength(ARTICLE_TITLE_MAX, { message: 'errors.article.title.maxLength' })
  declare readonly title: string;

  @ApiProperty({ maxLength: ARTICLE_BODY_MAX })
  @IsString({ message: 'errors.article.body.invalid' })
  @MaxLength(ARTICLE_BODY_MAX, { message: 'errors.article.body.maxLength' })
  declare readonly body: string;

  @ApiProperty({ enum: ArticleVisibility })
  @IsEnum(ArticleVisibility, { message: 'errors.article.visibility.invalid' })
  declare readonly visibility: ArticleVisibility;

  @ApiPropertyOptional({ type: [String], maxItems: ARTICLE_TAGS_MAX })
  @IsOptional()
  @IsArray({ message: 'errors.article.tags.invalid' })
  @ArrayMaxSize(ARTICLE_TAGS_MAX, { message: 'errors.article.tags.maxItems' })
  @IsString({ each: true, message: 'errors.article.tags.invalid' })
  readonly tags?: string[];

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'errors.article.priority.invalid' })
  @Min(1, { message: 'errors.article.priority.min' })
  @Max(100, { message: 'errors.article.priority.max' })
  readonly priority?: number;
}
```

**Update DTO via `PartialType`** — derive, do not re-declare. This keeps every decorator (and its `messageKey`) in one place and makes all fields optional.

```ts
// api/dto/update-article.dto.ts
import { PartialType } from '@core/openapi';
import { CreateArticleDto } from '@modules/article/api/dto/create-article.dto';

export class UpdateArticleDto extends PartialType(CreateArticleDto) {}
```

**Response DTO** — never return the persistence entity. Expose a stable, intentional contract; map the entity → response in `lib/<feature>.mappers.ts` (see [06-types-enums-constants.md](./06-types-enums-constants.md)). Use `@Exclude()`/`@Expose()` so secrets and internal columns never leak.

```ts
// api/dto/article-response.dto.ts
import { ApiProperty } from '@core/openapi';
import { Exclude, Expose } from '@core/validation';
import { ArticleVisibility } from '@modules/article/model/article.enums';

@Exclude()
export class ArticleResponseDto {
  @Expose() @ApiProperty() declare readonly id: string;
  @Expose() @ApiProperty() declare readonly title: string;
  @Expose()
  @ApiProperty({ enum: ArticleVisibility })
  declare readonly visibility: ArticleVisibility;
  @Expose() @ApiProperty() declare readonly createdAt: string;
}
```

---

## 5. Query DTOs — bound, coerce, and whitelist (rules 9, 37)

Query DTOs are the trust boundary protecting [04-repositories-and-persistence.md](./04-repositories-and-persistence.md) from injection and unbounded scans. Three non-negotiables:

**a. Bound and coerce pagination.** Query values arrive as strings; coerce with `@Type` and cap at the shared max (hard cap **100**).

**b. Whitelist sortable fields with an enum**, never a free string. The DTO validates the key; a constants map in `model/` resolves it to a safe column. The repository never receives a raw client identifier.

**c. Filter/enum fields use `@IsEnum`.** Unknown values are rejected at the boundary, so no raw string ever reaches a domain comparison (rule 9).

```ts
// api/dto/list-article-query.dto.ts
import { ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Type,
} from '@core/validation';
import {
  ArticleSortField,
  ArticleVisibility,
  SortDirection,
} from '@modules/article/model/article.enums';
import { LIST_LIMIT_MAX, LIST_PAGE_DEFAULT } from '@shared/constants';

export class ListArticleQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: LIST_PAGE_DEFAULT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page: number = LIST_PAGE_DEFAULT;

  @ApiPropertyOptional({ minimum: 1, maximum: LIST_LIMIT_MAX })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIST_LIMIT_MAX)
  readonly limit: number = 20;

  @ApiPropertyOptional({ enum: ArticleSortField })
  @IsOptional()
  @IsEnum(ArticleSortField, { message: 'errors.article.sortBy.invalid' })
  readonly sortBy: ArticleSortField = ArticleSortField.CreatedAt;

  @ApiPropertyOptional({ enum: SortDirection })
  @IsOptional()
  @IsEnum(SortDirection)
  readonly sortDirection: SortDirection = SortDirection.Desc;

  @ApiPropertyOptional({ enum: ArticleVisibility })
  @IsOptional()
  @IsEnum(ArticleVisibility)
  readonly visibility?: ArticleVisibility;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly search?: string;
}
```

```ts
// Don't — free-form sort string flows into an ORDER BY = SQL identifier injection
@IsOptional() @IsString() readonly sortBy?: string;
```

---

## 6. The Zod alternative — a custom `ZodValidationPipe`

Zod is the documented alternative when a project prefers single-source-of-truth schemas (`z.infer`), composability (`.merge()`, `.pick()`, `.partial()`), and rich transforms. Choose **one** validator per project and stay consistent — do not mix per endpoint. If Zod is chosen, OpenAPI schemas are declared manually since there is no decorator metadata.

```ts
// core/pipes/zod-validation.pipe.ts
import {
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';
import { type ZodType } from 'zod';
import { ValidationFailedError } from '@core/errors/validation-failed.error';

@Injectable()
export class ZodValidationPipe<TOutput> implements PipeTransform<
  unknown,
  TOutput
> {
  constructor(private readonly schema: ZodType<TOutput>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): TOutput {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ValidationFailedError(
        result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          messageKey: issue.message,
        })),
      );
    }
    return result.data; // defaults + coercion applied
  }
}
```

```ts
// api/dto/create-article.dto.ts  (Zod variant)
import { z } from 'zod';
import { ArticleVisibility } from '@modules/article/model/article.enums';
import { ARTICLE_TITLE_MAX } from '@modules/article/model/article.constants';

export const createArticleSchema = z.object({
  title: z
    .string({ message: 'errors.article.title.required' })
    .max(ARTICLE_TITLE_MAX, 'errors.article.title.maxLength'),
  visibility: z.nativeEnum(ArticleVisibility, {
    message: 'errors.article.visibility.invalid',
  }),
});
export type CreateArticleDto = z.infer<typeof createArticleSchema>;
```

- The pipe throws a typed `AppError`, never a raw `BadRequestException` — the global filter owns the response shape (see [18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md)).
- With Zod, **every `z.string()` needs `.max()`** and **every `z.array()` needs `.max()`** — the same bounding rule as §5.
- Apply per-argument: `@Body(new ZodValidationPipe(createArticleSchema))`. The schema and its `z.infer` type live together in `api/dto/`.

---

## 7. Every validation failure carries a `messageKey` (rules 26, i18n)

Each validation message **is** the i18n key — `errors.<feature>.<field>.<rule>` — never English prose. The global exception filter maps the failure to an HTTP status + sanitized body and resolves the key per supported locale (see [16-i18n-and-messaging.md](./16-i18n-and-messaging.md)). Cover every branch: required, type, min, max, format (`@IsUUID`, `@IsEmail`, `@IsUrl`), and custom rules each need a distinct key.

```ts
// Do — the message is the messageKey
@MaxLength(ARTICLE_TITLE_MAX, { message: 'errors.article.title.maxLength' })

// Don't — human prose leaks to the client and cannot be translated
@MaxLength(200, { message: 'Title must be at most 200 characters' })
```

A new DTO is **not done** until each supported locale has the new keys.

---

## 8. Keep validation in the DTO, not the service

- Shape, length, format, and cross-field rules belong in the DTO — via decorators / a custom `@ValidatorConstraint`, or `.refine()` / `.superRefine()` in Zod. Services orchestrate; they do not re-validate shapes (see [03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md)).
- **Business invariants** (state-machine guards, ownership, balance checks) belong in `domain/`, not the DTO. The DTO proves the request is _well-formed_; the domain proves it is _allowed_.
- Avoid unsafe regex (ReDoS): no nested quantifiers. Split a simple regex from a `.refine()`/custom validator for the complex part (see [08-database-and-injection-safety.md](./08-database-and-injection-safety.md)).
- Do not duplicate the same check across layers unless it is deliberately defensive — then comment _why_.

---

## Checklist (DTO / validation changes)

- [ ] Every new boundary (body, params, query, headers, files, webhook, integration response) is parsed by a DTO before the service.
- [ ] DTO class/schema + its type live in `api/dto/<name>.dto.ts` — nothing inline in controllers/services/repositories/use-cases.
- [ ] Naming follows `create-/update-/list-…-query/<action>/…-response`; `UpdateXDto extends PartialType(CreateXDto)`.
- [ ] Global `ValidationPipe` flags intact: `whitelist`, `forbidNonWhitelisted`, `transform`.
- [ ] Every string is `@MaxLength`-bounded; every array is `@ArrayMaxSize`-bounded; enums via `@IsEnum`/`z.nativeEnum`, never string unions.
- [ ] Query DTOs cap `limit` (≤ 100), whitelist `sortBy` via an enum + constants map, and validate enum filters.
- [ ] Identity comes from `@CurrentUser()` (verified token), never the request body.
- [ ] Response DTO returned via a mapper — no entity leaks, secrets excluded with `@Exclude`/`@Expose`.
- [ ] Every validation rule's message is an `errors.<feature>.<key>` key; each supported locale has it.
- [ ] If Zod is the project's choice, the `ZodValidationPipe` throws a typed `AppError`, not a raw exception.
- [ ] `npm run lint` · `npm run typecheck` · `npm run test` green; integration tests run when routes changed.
