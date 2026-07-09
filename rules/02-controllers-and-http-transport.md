# 02 — Controllers & HTTP Transport

> Controllers are the **transport adapter**: they translate HTTP ⇄ application calls and contain **zero business logic**. This file implements the transport layer of the canon in [/context/architecture-map.md](../context/architecture-map.md) and rules 17–18 of [00-non-negotiable-rules.md](./00-non-negotiable-rules.md). One delegation per method, enforced by `architecture/controller-no-logic`.

A controller does four things and nothing more: declare the route + OpenAPI shape, attach guards/pipes/interceptors, bind validated input from decorators, and **return exactly one application call**. Every other concern lives below it — orchestration in [03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md), validation in the DTO ([05-dto-and-validation.md](./05-dto-and-validation.md)), errors in the global filter ([18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md)), authorization in guards ([07-security-authn-authz.md](./07-security-authn-authz.md)).

---

## Controllers MAY

- Declare routing + OpenAPI metadata: `@Controller`, `@Get`/`@Post`/`@Patch`/`@Put`/`@Delete`, `@HttpCode`, `@ApiTags`/`@ApiOperation`/`@ApiResponse`.
- Bind input through parameter decorators: `@Body`, `@Param`, `@Query`, plus app decorators `@CurrentUser()` and `@RequirePermissions()`.
- Attach guards (`@UseGuards`), pipes (DTO validation runs via the global `ValidationPipe`; targeted pipes like `ParseUUIDPipe` are allowed), and interceptors (`@UseInterceptors`).
- Delegate to **exactly one** application method (a service or a use case) and `return` its result.
- Carry a `private readonly` injected service/use case via constructor DI.

## Controllers MUST NOT

- Contain business rules, branching on domain state, multi-step orchestration, transformation, or persistence — push it down to a service/use case ([03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md)).
- Call more than one application method to fulfill a request — compose in the application layer, not here.
- Import repositories, infrastructure, ORM clients, or vendor SDKs (`architecture/no-restricted-layer-imports`).
- Define inline types/interfaces/enums/constants/DTOs/response shapes (rules 10–16; `no-restricted-syntax`).
- Compare domain strings — use enum members from `@shared/enums` ([06-types-enums-constants.md](./06-types-enums-constants.md), rule 9).
- Read `process.env` (rule 27) or use `console.*` (rule 28).
- Wrap bodies in `try/catch` to build error responses — throw typed `AppError`s and let the global exception filter format them ([18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md)).
- Read identity from the request body — identity comes from the verified token via `@CurrentUser()` (rule 33).
- Shape responses inline — use a `lib/` mapper or a response interceptor (see [Response shaping](#response-shaping)).

---

## The request pipeline — the order is fixed

NestJS runs the chain below; a controller method is the last step. Guards run **before** validation, so an unauthorized caller never reaches your DTO. Identity, then authorization, then ownership, then validation, then the handler.

| Stage                | Mechanism                                           | Why this order                                                                   |
| -------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1 Authentication     | auth guard (`@UseGuards(AuthGuard)`)                | Establishes the verified principal. Nothing trusts the client until this passes. |
| 2 Authorization      | permissions/RBAC guard (`@RequirePermissions(...)`) | Checks the principal against a central permission catalog. Authn ≠ authz.        |
| 3 Ownership / tenant | ownership guard or an application-layer check       | Blocks IDOR / cross-tenant access on resources fetched by id.                    |
| 4 Validation         | global `ValidationPipe` (`whitelist`, `transform`)  | DTO validation runs only after the caller is known to be allowed.                |
| 5 Handler            | controller method                                   | One delegation → one application call → return.                                  |
| 6 Response / errors  | response interceptor; global exception filter       | Shapes the success envelope; maps thrown `AppError` → safe `{ messageKey }`.     |

Mount the always-on guards globally (auth + RBAC in [07-security-authn-authz.md](./07-security-authn-authz.md)); annotate truly open routes with a `@Public()` decorator rather than removing the guard. Internal service-to-service endpoints use a separate route prefix and their own credential — never just "no guard".

---

## The standard controller shape

```ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@core/decorators/current-user.decorator';
import { RequirePermissions } from '@core/decorators/require-permissions.decorator';
import { AuthUser } from '@shared/types/auth-user.type';
import { Permission } from '@shared/enums/permission.enum';
import { ArticleService } from '@modules/article/application/article.service';
import { CreateArticleDto } from '@modules/article/api/dto/create-article.dto';
import { ListArticleQueryDto } from '@modules/article/api/dto/list-article-query.dto';
import { ArticleResponseDto } from '@modules/article/api/dto/article-response.dto';

@ApiTags('articles')
@Controller('articles')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ARTICLE_CREATE)
  @ApiOperation({ summary: 'Create an article' })
  @ApiCreatedResponse({ type: ArticleResponseDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateArticleDto,
  ): Promise<ArticleResponseDto> {
    return this.articleService.create(user.id, dto); // one delegation, identity from the token
  }

  @Get(':id')
  @RequirePermissions(Permission.ARTICLE_READ)
  @ApiOperation({ summary: 'Get an article by id' })
  @ApiOkResponse({ type: ArticleResponseDto })
  getById(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<ArticleResponseDto> {
    return this.articleService.getById(user.id, id);
  }

  @Get()
  @RequirePermissions(Permission.ARTICLE_READ)
  @ApiOperation({ summary: 'List articles' })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListArticleQueryDto,
  ): Promise<PaginatedResult<ArticleResponseDto>> {
    return this.articleService.list(user.id, query); // pagination caps live in the DTO + repository
  }

  @Patch(':id')
  @RequirePermissions(Permission.ARTICLE_UPDATE)
  @ApiOperation({ summary: 'Update an article' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
  ): Promise<ArticleResponseDto> {
    return this.articleService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.ARTICLE_DELETE)
  @ApiOperation({ summary: 'Delete an article' })
  delete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.articleService.delete(user.id, id);
  }
}
```

> `PaginatedResult<T>`, `AuthUser`, and `Permission` are imported types/enums — never declared inline. Each method body is a single `return` of one application call. The controller never sees the ORM, the repository, or a vendor SDK.

---

## One delegation per method (`architecture/controller-no-logic`)

A controller method must be exactly one `return` of a direct delegation. No branching, no `await`-then-transform, no two service calls.

```ts
// Don't — a business decision in the controller
@Post(':id/publish')
publish(@Param('id') id: string): Promise<ArticleResponseDto> {
  const article = await this.articleService.getById(id);
  if (article.status === ArticleStatus.Draft && article.sections.length > 3) {
    return this.articleService.autoPublish(id); // this rule belongs in the application layer
  }
  return this.articleService.publish(id);
}

// Don't — two services stitched together to fulfill one use case
@Get(':id/detail')
detail(@Param('id') id: string): Promise<unknown> {
  const article = await this.articleService.getById(id);
  const comments = await this.commentService.listFor(id);
  return { ...article, comments }; // orchestration belongs in ONE application method
}

// Do — one orchestration call; the use case composes article + comments
@Get(':id/detail')
@RequirePermissions(Permission.ARTICLE_READ)
detail(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ArticleDetailDto> {
  return this.getArticleDetailUseCase.execute(user.id, id);
}
```

If a handler needs a multi-step or multi-entity flow under one transaction, it delegates to a **use case**, not a fatter controller (see service-vs-use-case in [03-application-services-and-use-cases.md](./03-application-services-and-use-cases.md)).

---

## Identity, params, and queries

- **Identity** comes only from `@CurrentUser()`, populated by the auth guard from the verified token. Never trust `dto.userId` / `body.tenantId` for authorization (rule 33). Pass the authenticated id into the application method so ownership/tenant checks run server-side.
- **Path params** arrive as `string`. Validate format at the boundary with a pipe when it matters: `@Param('id', ParseUUIDPipe) id: string`. Don't hand-narrow with `!`.
- **Queries** are validated and coerced by a query DTO under the global `ValidationPipe` (`transform: true`). Never `Number.parseInt(req.query.limit)` by hand — that bypasses the pagination cap; the limit ceiling (hard max 100) is declared once in the DTO and re-enforced in the repository ([04-repositories-and-persistence.md](./04-repositories-and-persistence.md), [09-performance-and-scalability.md](./09-performance-and-scalability.md)).

```ts
// Do — bounded, typed pagination via a query DTO
@Get()
list(@Query() query: ListArticleQueryDto): Promise<PaginatedResult<ArticleResponseDto>> {
  return this.articleService.list(query); // ListArticleQueryDto caps `limit` at 100 with @Max(100)
}
```

---

## Validation at the boundary

All HTTP-boundary validation happens in DTOs via the **global** `ValidationPipe` (`whitelist: true`, `transform: true`) — class-validator is primary; a `ZodValidationPipe` is the documented alternative ([05-dto-and-validation.md](./05-dto-and-validation.md)). The controller declares `@Body() dto: CreateArticleDto`; it does **not** call validators itself, and validation rules never live in the service.

```ts
// Don't — validating inside the handler
create(@Body() body: unknown) {
  if (typeof body !== 'object' || !body) throw new BadRequestException();
  // ...hand-rolled checks
}

// Do — the DTO + global pipe own validation; the body is already typed and clean
create(@Body() dto: CreateArticleDto): Promise<ArticleResponseDto> {
  return this.articleService.create(dto);
}
```

---

## Response shaping

Shape responses in a **response interceptor** (a uniform envelope with `meta` for all routes) or a **`lib/` mapper** (entity → response DTO). Never build the envelope or map fields inline in a controller.

```ts
// Don't — inline shaping in the controller
getById(@Param('id') id: string) {
  const a = await this.articleService.getById(id);
  return { data: { id: a.id, title: a.title }, ts: Date.now() }; // envelope + mapping inline
}

// Do — service returns a response DTO (mapped in lib/), interceptor wraps the envelope
getById(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ArticleResponseDto> {
  return this.articleService.getById(user.id, id);
}
```

- Set status codes with `@HttpCode(HttpStatus.CREATED)` / `@HttpCode(HttpStatus.NO_CONTENT)` — don't touch the raw response object.
- Prefer returning a value over injecting the framework response (`@Res()`). Reserve `@Res({ passthrough: true })` for genuine streaming/binary downloads, and document why.
- Use one envelope shape across the app via the interceptor — never invent a per-controller response format.

---

## Errors — throw, don't catch

No `try/catch` in controllers. Application/domain layers throw typed `AppError` subclasses carrying a `messageKey` (`errors.<feature>.<key>`); the global exception filter maps them to an HTTP status + sanitized body and logs full detail server-side ([18-error-handling-and-exceptions.md](./18-error-handling-and-exceptions.md), [16-i18n-and-messaging.md](./16-i18n-and-messaging.md)). Stack traces, SQL, and secrets never reach the client (rule 36).

```ts
// Don't — building error responses by hand in the controller
getById(@Param('id') id: string) {
  try {
    return await this.articleService.getById(id);
  } catch (e) {
    return { error: String(e) }; // leaks internals, bypasses the filter
  }
}

// Do — let it throw; the filter formats the safe body
getById(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ArticleResponseDto> {
  return this.articleService.getById(user.id, id); // service throws NotFoundAppError('errors.article.notFound')
}
```

---

## OpenAPI / Swagger

Document every public route. Keep decorators on the controller (they describe the HTTP contract, which is the controller's job); keep referenced schemas in DTO files.

- `@ApiTags(...)` once per controller; `@ApiOperation({ summary })` per method.
- `@ApiOkResponse`/`@ApiCreatedResponse({ type: <ResponseDto> })` referencing a response DTO class — never an inline object literal.
- `@ApiBearerAuth()` on protected controllers; mark open routes consistently (e.g. an `@Public()` decorator).
- `@ApiQuery`/`@ApiParam` only when the DTO/pipe can't express it.

---

## Decomposing a large controller (facade)

When a controller accumulates many handlers, split by cohesion into collaborator classes behind a **thin facade** so the public route surface stays byte-identical (routes, module wiring, and tests don't change).

- The facade injects the collaborators as `private readonly` fields; each public method delegates **one line** and keeps its exact name, signature, decorators, and OpenAPI metadata.
- Collaborators live beside the controller (e.g. `api/article-write.controller-part.ts`, `api/article-read.controller-part.ts`) and obey the **same** import boundary: services/use cases only, no repository/infrastructure/SDK.
- Move shared helpers (a `@CurrentUser()` extractor, a permission constant) to one shared file — don't duplicate them per part.
- This is a pure structural move: method bodies relocate verbatim, behavior unchanged. See [decompose-large-file.md](../skills/decompose-large-file.md).

---

## Anti-patterns (quick reference)

```ts
// Don't — ORM/repository in the controller (architecture/no-restricted-layer-imports)
constructor(private readonly repo: ArticleRepository) {}

// Don't — process.env in the controller (rule 27)
const region = process.env.REGION;

// Don't — inline type + magic string (rules 9, 10)
const payload: { state: string } = { state: 'published' };

// Don't — console logging (rule 28)
console.log('created', dto);

// Do — typed DI, enum value, one delegation, identity from the token
create(@CurrentUser() user: AuthUser, @Body() dto: CreateArticleDto): Promise<ArticleResponseDto> {
  return this.articleService.create(user.id, dto);
}
```

---

## Checklist

- [ ] `@Controller` + per-method HTTP decorator + OpenAPI metadata present
- [ ] Each method is one delegation to a single application method (`architecture/controller-no-logic`)
- [ ] Auth guard + permissions guard chained on every protected route; open routes marked `@Public()` (rules 33–34)
- [ ] Identity from `@CurrentUser()` (verified token), never from the body (rule 33)
- [ ] Input via `@Body`/`@Param`/`@Query` DTOs; validation in the DTO under the global `ValidationPipe` (rule 25)
- [ ] No inline types/enums/consts/DTOs/response shapes; no domain string comparisons (rules 9–16)
- [ ] No repository/infrastructure/SDK imports; no `process.env`; no `console.*` (rules 27, 28, 32)
- [ ] No `try/catch` — throw typed `AppError`s with `messageKey`; let the exception filter format (rules 26, 36)
- [ ] Status codes via `@HttpCode`; responses shaped by interceptor/mapper, not inline
- [ ] Lists paginated with a hard max limit; no hand-parsed pagination (rule 37)
- [ ] `npm run lint` / `typecheck` / `test` green; tests cover each handler (rule 42)
