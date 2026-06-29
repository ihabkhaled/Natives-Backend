# Skill: Add a Controller Method

> Add a thin HTTP transport method — decorators + DTO-bound input + the auth/permissions/ownership guard chain + **exactly one** delegation to an application method. Implements the transport layer of the canon ([/context/architecture-map.md](../context/architecture-map.md)) and [02-controllers-and-http-transport.md](../rules/02-controllers-and-http-transport.md).

A controller method does four things and nothing else: declare the route + OpenAPI contract, attach guards/pipes, bind validated input via parameter decorators, and `return` one application call. Branching, transformation, multi-call orchestration, persistence, and error formatting all live below it.

---

## Rules this skill enforces

- **One delegation per method** — a single `return` of one service/use-case call. No branching, no `await`-then-transform, no two calls (`architecture/controller-no-logic`; rules 17–18).
- **No business logic, no persistence, no vendor SDKs** in the controller. It cannot import repositories/infrastructure/ORM clients (`architecture/no-restricted-layer-imports`; rule 19).
- **No inline types/interfaces/enums/constants/DTOs/response shapes** — import them from `api/dto/`, `model/`, `@shared/*` (rules 10–16; `no-restricted-syntax`).
- **Identity from the verified token only** via `@CurrentUser()` — never from the request body (rule 33).
- **Guard chain on every protected route**: auth → permissions (RBAC) → ownership/tenant (rules 33–35).
- **Validation in the DTO** under the global `ValidationPipe` (`whitelist:true`, `transform:true`) — never hand-rolled in the handler (rule 25).
- **Throw, don't catch** — typed `AppError`s carry a `messageKey`; the global exception filter formats the safe body (rules 26, 36).
- **Lists paginate with a hard max limit** declared in the query DTO (`@Max(100)`); never hand-parse pagination (rule 37).
- **Typed config + logger adapter** — no `process.env`, no `console.*` (rules 27, 28).

---

## Tests FIRST

Before touching the controller, write or extend `test/<feature>/<feature>.controller.spec.ts` (Vitest 4 + `@nestjs/testing`): build a testing module with the application provider mocked, and for each handler assert (a) the application method is called with the exact extracted args (including the id from `@CurrentUser()`, **not** the body), (b) the returned value is passed through unchanged, and (c) a thrown `AppError` propagates (the filter is exercised in the e2e/integration suite, not here). Per-file coverage floor is 95% (critical paths near 100%). See [write-unit-tests.md](./write-unit-tests.md) and [/testing/unit-testing-standard.md](../testing/unit-testing-standard.md).

---

## Step 1 — Confirm the target delegation exists

A controller method needs exactly one application method to call. Pick the right collaborator first:

- **Service** for a focused capability (CRUD, a read/projection, a single-write flow) — the default. See [create-service.md](./create-service.md).
- **Use case** only for a multi-entity / multi-step operation under one transaction + ordered post-commit events. See [create-use-case.md](./create-use-case.md).

If no method exists yet, build it first — the controller is the last thing you write.

## Step 2 — Add the request DTO (input contract)

All boundary validation lives in the DTO, not the handler. Caps and formats are declared once, here.

```ts
// api/dto/create-<feature>.dto.ts
import { IsString, MaxLength } from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @MaxLength(200)
  readonly title!: string;
}
```

For list endpoints, the query DTO owns the pagination ceiling (the repository re-enforces it):

```ts
// api/dto/list-<feature>-query.dto.ts
import { Type } from 'class-transformer';
import { IsInt, Max, Min, IsOptional } from 'class-validator';

export class ListArticleQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @IsOptional()
  readonly page: number = 1;

  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() // hard cap — rule 37
  readonly limit: number = 20;
}
```

`class-validator` is primary; the `ZodValidationPipe` is the documented alternative. See [create-dto-validation.md](./create-dto-validation.md) and [05-dto-and-validation.md](../rules/05-dto-and-validation.md).

## Step 3 — Add the method: decorators, guard chain, input binding

Mount the always-on auth + RBAC guards globally; annotate the method with the required permission. Bind input through parameter decorators only.

```ts
// api/<feature>.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '@core/decorators/current-user.decorator';
import { RequirePermissions } from '@core/decorators/require-permissions.decorator';
import { AuthUser } from '@shared/types/auth-user.type';
import { Permission } from '@shared/enums/permission.enum';
import { ArticleService } from '@modules/article/application/article.service';
import { CreateArticleDto } from '@modules/article/api/dto/create-article.dto';
import { ArticleResponseDto } from '@modules/article/api/dto/article-response.dto';

@ApiTags('articles')
@ApiBearerAuth()
@Controller('articles')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ARTICLE_CREATE) // authorization, not just authentication
  @ApiOperation({ summary: 'Create an article' })
  @ApiCreatedResponse({ type: ArticleResponseDto })
  create(
    @CurrentUser() user: AuthUser,        // identity from the verified token — never the body
    @Body() dto: CreateArticleDto,        // already validated + transformed by the global pipe
  ): Promise<ArticleResponseDto> {
    return this.articleService.create(user.id, dto); // ONE delegation, ownership enforced below
  }
}
```

- Set status with `@HttpCode(...)` — never touch the raw response object.
- Validate `:id` format at the boundary when it matters: `@Param('id', ParseUUIDPipe) id: string` — don't narrow with `!`.
- Open routes are marked `@Public()` rather than dropping the guard. See [add-guard-and-permission.md](./add-guard-and-permission.md) and [07-security-authn-authz.md](../rules/07-security-authn-authz.md).

## Step 4 — Keep it to one delegation

```ts
// Don't — a business decision in the controller
@Post(':id/publish')
publish(@Param('id') id: string): Promise<ArticleResponseDto> {
  const article = await this.articleService.getById(id);
  if (article.status === ArticleStatus.DRAFT) return this.articleService.autoPublish(id);
  return this.articleService.publish(id); // rule belongs in the application layer
}

// Don't — two calls stitched to fulfill one request
@Get(':id/detail')
detail(@Param('id') id: string): Promise<unknown> {
  const article = await this.articleService.getById(id);
  const comments = await this.commentService.listFor(id);
  return { ...article, comments }; // orchestration belongs in ONE use case
}

// Do — one orchestration call; the use case composes the parts
@Get(':id/detail')
@RequirePermissions(Permission.ARTICLE_READ)
detail(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ArticleDetailDto> {
  return this.getArticleDetailUseCase.execute(user.id, id);
}
```

## Step 5 — Errors and responses (don't shape inline)

- **No `try/catch`.** The application/domain layer throws a typed `AppError` with a `messageKey` (`errors.<feature>.<key>`); the global exception filter maps it to status + sanitized body and logs full detail server-side. Stack traces, SQL, and secrets never reach the client. See [create-error.md](./create-error.md) and [18-error-handling-and-exceptions.md](../rules/18-error-handling-and-exceptions.md).
- **No inline shaping.** The service returns a response DTO (mapped in `lib/`); a response interceptor wraps the uniform envelope. Never build `{ data, meta }` or map fields in the handler.

```ts
// Do — let it throw; the filter formats the safe body, the interceptor wraps it
getById(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ArticleResponseDto> {
  return this.articleService.getById(user.id, id); // throws NotFoundAppError('errors.article.notFound')
}
```

## Step 6 — Wire and document

- Register the controller in `<feature>.module.ts` `controllers: [...]` if it is new; the public surface stays in `index.ts` (don't export internals).
- Per method: `@ApiOperation({ summary })` and `@ApiOkResponse`/`@ApiCreatedResponse({ type: <ResponseDto> })` referencing a DTO class — never an inline object literal.
- User-facing copy is delivered via `messageKey` per supported locale — no hardcoded strings. See [add-i18n-message-key.md](./add-i18n-message-key.md).

---

## Quality gates

```bash
npm run lint           # 0 errors, 0 warnings — incl. the architecture plugin
npm run typecheck      # tsgo --noEmit, full strict
npm run test           # Vitest 4 — controller spec passes
npm run test:coverage  # ≥ 95% on touched files
npm run build
```

Never bypass Husky with `--no-verify` (pre-commit: lint-staged + typecheck; commit-msg: commitlint; pre-push: test:coverage + build).

## Pitfalls

- **Reading identity from the body** (`dto.userId`, `body.tenantId`) for authorization — always `@CurrentUser()`. This is the classic IDOR/cross-tenant hole (rule 33).
- **A second service call sneaking into a handler** to "just combine results" — push it into one use case; the ESLint rule will block it anyway.
- **Hand-parsing pagination** (`Number(query.limit)`) — bypasses the 100-cap and risks an unbounded query. Cap lives in the query DTO with `@Max(100)` (rule 37).
- **`@Res()` to send the response** — return a value instead; reserve `@Res({ passthrough: true })` for genuine streaming/binary downloads and document why.
- **`try/catch` building an error body** — leaks internals and bypasses the filter; throw a typed `AppError`.
- **`async` handler with no `await`** trips `require-await`; a pass-through `return this.service.x()` needs no `async`. If there is nothing to await, it is not a controller method.
- **Inline DTO, type, or response object** in the method — extract to `api/dto/` or `model/` (`no-restricted-syntax`). See [known-pitfalls.md](../memory/known-pitfalls.md).

## Related

[create-service.md](./create-service.md) · [create-use-case.md](./create-use-case.md) · [create-dto-validation.md](./create-dto-validation.md) · [add-guard-and-permission.md](./add-guard-and-permission.md) · [create-error.md](./create-error.md) · [write-unit-tests.md](./write-unit-tests.md) · [02-controllers-and-http-transport.md](../rules/02-controllers-and-http-transport.md) · [README](./README.md)
