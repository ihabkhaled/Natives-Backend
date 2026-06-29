# Reference Patterns — Copy-Ready NestJS by Layer

> The canonical, copy-ready code for every layer and cross-cutting concern in this workspace. One tight, strict-TypeScript snippet per concern; each obeys the layer/import/lint rules. This implements [`architecture-map.md`](./architecture-map.md) and [`/rules/00-non-negotiable-rules.md`](../rules/00-non-negotiable-rules.md) — when in doubt, those win. Replace `<feature>` with your bounded feature; `Article` is used illustratively only.

Every snippet here is **strict TS** (no `any`, no `!`, no inline declarations, explicit return types) and respects the one-way dependency rule and `architecture/*` ESLint rules. Use these as scaffolding starting points; generate new files with the [`/skills`](../skills/README.md).

---

## 1. Bootstrap — `main.ts` + app assembly

`bootstrap/` and `config/` are the **only** places allowed to read `process.env`. Boot order: build the app on the Fastify adapter → global pipes → global filter → Swagger → listen. Keep the assembly functions small and individually testable.

```ts
// src/main.ts
import { bootstrap } from '@app/bootstrap/bootstrap';

void bootstrap();
```

```ts
// src/bootstrap/bootstrap.ts  (process.env permitted here)
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { AppModule } from '@app/app.module';
import { AppExceptionFilter } from '@core/errors/app-exception.filter';
import { AppLogger } from '@core/logger/app-logger.service';
import type { AppConfig } from '@config/app.config';
import { BODY_LIMIT_BYTES, LISTEN_HOST } from './bootstrap.constants';
import { setupSwagger } from './swagger';

export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: BODY_LIMIT_BYTES }),
    { bufferLogs: true },
  );
  app.useLogger(app.get(AppLogger));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.useGlobalFilters(app.get(AppExceptionFilter));
  setupSwagger(app);
  return app;
}

export async function bootstrap(): Promise<void> {
  const app = await createApp();
  const config = app.get(ConfigService<AppConfig, true>);
  await app.listen(config.get('app.port', { infer: true }), LISTEN_HOST);
}
```

```ts
// src/bootstrap/swagger.ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';

import { SWAGGER_AUTH_NAME, SWAGGER_PATH } from './bootstrap.constants';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Service API')
    .setDescription('OpenAPI surface for this service')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, SWAGGER_AUTH_NAME)
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
```

> **Do** keep `whitelist: true` (strips unknown props) and `transform: true` (DTO class instances). **Don't** sprinkle `app.use(...)` business logic in `bootstrap.ts` — it is assembly only.

---

## 2. Configuration — typed namespace + fail-fast validation

Read config through `ConfigService`, never `process.env`, outside `config/`/`bootstrap/`. Validate at startup so invalid env crashes the boot, not a request three hours later.

```ts
// src/config/app.config.ts  (process.env permitted here)
import { registerAs } from '@nestjs/config';

import { DEFAULT_PORT } from './config.constants';
import type { AppNamespaceConfig } from './config.types';

export const appConfig = registerAs(
  'app',
  (): AppNamespaceConfig => ({
    port: Number(process.env['PORT'] ?? DEFAULT_PORT),
    nodeEnv: process.env['NODE_ENV'] ?? 'development',
  }),
);

export interface AppConfig {
  app: AppNamespaceConfig;
}
```

```ts
// src/config/env.validation.ts  (process.env permitted here)
import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, Max, Min, validateSync } from 'class-validator';

import { NodeEnv } from '@shared/enums';

class EnvironmentVariables {
  @IsEnum(NodeEnv) readonly NODE_ENV!: NodeEnv;
  @IsInt() @Min(1) @Max(65535) readonly PORT!: number;
}

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const parsed = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(parsed, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment: ${errors.toString()}`);
  }
  return parsed;
}
```

> Wire both into the root module: `ConfigModule.forRoot({ isGlobal: true, load: [appConfig], validate: validateEnv })`. See [`/rules/17-configuration-and-environment.md`](../rules/17-configuration-and-environment.md) and [`/skills/add-config-value.md`](../skills/add-config-value.md).

---

## 3. Errors — typed `AppError` base + a subclass

Every user-facing failure is a typed `AppError` carrying a `messageKey` of the form `errors.<feature>.<key>`. The filter maps it to status + sanitized body; never throw raw `Error` across the HTTP boundary.

```ts
// src/core/errors/app-error.ts
import { HttpStatus } from '@nestjs/common';

import type { ErrorMessageKey } from './error.types';

export abstract class AppError extends Error {
  abstract readonly status: HttpStatus;

  protected constructor(
    message: string,
    readonly messageKey: ErrorMessageKey,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
```

```ts
// src/core/errors/not-found.error.ts
import { HttpStatus } from '@nestjs/common';

import { AppError } from './app-error';
import type { ErrorMessageKey } from './error.types';

export class NotFoundError extends AppError {
  readonly status = HttpStatus.NOT_FOUND;

  constructor(resource: string, messageKey: ErrorMessageKey) {
    super(`${resource} was not found`, messageKey);
  }
}
```

> Mirror this for `ValidationError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `ConflictError` (409), `IntegrationError` (502). New keys get an entry per supported locale ([`/rules/16-i18n-and-messaging.md`](../rules/16-i18n-and-messaging.md), [`/skills/create-error.md`](../skills/create-error.md)).

---

## 4. Global exception filter

One filter sanitizes every throw. Known `AppError` → its status + `{ messageKey }`. Unknown error → 500 with a generic key; full detail logged server-side only. Never leak stacks, SQL, or secrets.

```ts
// src/core/errors/app-exception.filter.ts
import {
  Catch,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { AppError } from './app-error';
import { GENERIC_ERROR_KEY } from './error.constants';
import { toErrorBody } from './error-body.mapper';
import { AppLogger } from '@core/logger/app-logger.service';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    if (exception instanceof AppError) {
      this.logger.warn('handled.app_error', { messageKey: exception.messageKey });
      void reply.status(exception.status).send(toErrorBody(exception));
      return;
    }
    this.logger.error('unhandled.exception', { error: exception });
    void reply
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .send({ messageKey: GENERIC_ERROR_KEY });
  }
}
```

> See [`/rules/18-error-handling-and-exceptions.md`](../rules/18-error-handling-and-exceptions.md). Register globally in bootstrap (above) or as an `APP_FILTER` provider.

---

## 5. Logger adapter — port + provider

The logger is wrapped behind an app-owned port; business code depends on the interface, never on `pino`/`winston`/`console`. Swap the implementation in one place.

```ts
// src/core/logger/app-logger.port.ts
export interface LogContext {
  readonly [key: string]: unknown;
}

export interface AppLoggerPort {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
}
```

```ts
// src/core/logger/app-logger.service.ts
import { Injectable, type LoggerService } from '@nestjs/common';

import { redact } from './log-redaction.helper';
import type { AppLoggerPort, LogContext } from './app-logger.port';

@Injectable()
export class AppLogger implements AppLoggerPort, LoggerService {
  info(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }
  warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }
  error(message: string, context?: LogContext): void {
    this.write('error', message, context);
  }
  debug(message: string, context?: LogContext): void {
    this.write('debug', message, context);
  }

  private write(level: string, message: string, context?: LogContext): void {
    // Delegate to the wrapped logging library here; redact before emit.
    process.stdout.write(`${JSON.stringify({ level, message, ...redact(context) })}\n`);
  }
}
```

> Never `console.*`. Redact secrets/PII at the boundary. See [`/rules/14-observability-and-logging.md`](../rules/14-observability-and-logging.md).

---

## 6. Controller — thin transport

A controller method is **one** delegation: parse via DTO/decorators → call one application method → return it. No branching, no transformation, no repository imports (`architecture/controller-no-logic`, `architecture/no-restricted-layer-imports`).

```ts
// src/modules/article/api/article.controller.ts
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { ArticleService } from '../application/article.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { ArticleResponseDto } from './dto/article-response.dto';
import { CurrentUser } from '@core/decorators/current-user.decorator';
import { RequirePermissions } from '@core/decorators/require-permissions.decorator';
import { AuthGuard } from '@core/guards/auth.guard';
import { PermissionsGuard } from '@core/guards/permissions.guard';
import { Permission } from '@shared/enums';
import type { AuthenticatedUser } from '@shared/types';

@Controller('articles')
@UseGuards(AuthGuard, PermissionsGuard)
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get(':id')
  @RequirePermissions(Permission.ArticleRead)
  getById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ArticleResponseDto> {
    return this.articleService.getById(id, user);
  }

  @Post()
  @RequirePermissions(Permission.ArticleCreate)
  create(
    @Body() dto: CreateArticleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ArticleResponseDto> {
    return this.articleService.create(dto, user);
  }
}
```

> Identity comes from `@CurrentUser()` (the verified token), never the request body. See [`/rules/02-controllers-and-http-transport.md`](../rules/02-controllers-and-http-transport.md).

---

## 7. DTOs — request + response (class-validator primary)

Validation lives in the DTO, not the service. `whitelist: true` strips unknown props; bound every string and list. Zod via a `ZodValidationPipe` is the documented alternative ([`/rules/05-dto-and-validation.md`](../rules/05-dto-and-validation.md)).

```ts
// src/modules/article/api/dto/create-article.dto.ts
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

import { ArticleCategory } from '../../model/article.enums';
import { ARTICLE_TITLE_MAX, ARTICLE_TITLE_MIN } from '../../model/article.constants';

export class CreateArticleDto {
  @IsString()
  @MinLength(ARTICLE_TITLE_MIN)
  @MaxLength(ARTICLE_TITLE_MAX)
  readonly title!: string;

  @IsEnum(ArticleCategory)
  readonly category!: ArticleCategory;
}
```

```ts
// src/modules/article/api/dto/article-response.dto.ts
import type { ArticleCategory } from '../../model/article.enums';

export class ArticleResponseDto {
  readonly id!: string;
  readonly title!: string;
  readonly category!: ArticleCategory;
  readonly createdAt!: string;
}
```

> DTOs are pure shapes — never import services/repositories/infrastructure (`architecture/no-restricted-layer-imports`).

---

## 8. Service — focused capability (≤20 lines/method)

A service orchestrates one capability: extract inputs → check preconditions → delegate to domain/repo/adapter → return a typed result. No inline declarations; no `Promise.all` (lint-enforced); ≤20 lines/method.

```ts
// src/modules/article/application/article.service.ts
import { Injectable } from '@nestjs/common';

import { ArticleRepository } from '../infrastructure/article.repository';
import { toArticleResponse } from '../lib/article.mappers';
import { assertCanView } from '../domain/article.policy';
import { CreateArticleDto } from '../api/dto/create-article.dto';
import { ArticleResponseDto } from '../api/dto/article-response.dto';
import { NotFoundError } from '@core/errors/not-found.error';
import { ARTICLE_NOT_FOUND_KEY } from '../model/article.constants';
import type { AuthenticatedUser } from '@shared/types';

@Injectable()
export class ArticleService {
  constructor(private readonly articleRepo: ArticleRepository) {}

  async getById(id: string, user: AuthenticatedUser): Promise<ArticleResponseDto> {
    const article = await this.articleRepo.findById(id);
    if (article === null) {
      throw new NotFoundError('Article', ARTICLE_NOT_FOUND_KEY);
    }
    assertCanView(article, user);
    return toArticleResponse(article);
  }

  async create(dto: CreateArticleDto, user: AuthenticatedUser): Promise<ArticleResponseDto> {
    const created = await this.articleRepo.create({ ...dto, ownerId: user.id });
    return toArticleResponse(created);
  }
}
```

> Ownership/tenant is a precondition (`assertCanView`), defense-in-depth behind the guard. Mapping/formatting lives in `lib/`. See [`/rules/03-application-services-and-use-cases.md`](../rules/03-application-services-and-use-cases.md) and [`/skills/create-service.md`](../skills/create-service.md).

---

## 9. Use case — multi-entity work under one transaction

Escalate to a use case only for the exceptional shape: multiple entities mutated under one transaction/invariant **and** ordered post-commit events. Use cases call services; services never call use cases. Reads/decisions hoist before the `try`; events fire **after** commit.

```ts
// src/modules/article/application/publish-article.use-case.ts
import { Injectable } from '@nestjs/common';

import { UnitOfWork } from '@core/persistence/unit-of-work';
import { DomainEventBus } from '@core/events/domain-event-bus';
import { ArticleService } from './article.service';
import { ReviewService } from '../../review/index';
import { buildPublishedEvent } from '../lib/article.events';
import type { ArticleResponseDto } from '../api/dto/article-response.dto';
import type { AuthenticatedUser } from '@shared/types';

@Injectable()
export class PublishArticleUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly articles: ArticleService,
    private readonly reviews: ReviewService,
    private readonly events: DomainEventBus,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<ArticleResponseDto> {
    const published = await this.uow.run(async tx => {
      const article = await this.articles.markPublished(id, user, tx);
      await this.reviews.closeOpenReviews(id, tx);
      return article;
    });
    await this.events.publish(buildPublishedEvent(published, user));
    return published;
  }
}
```

> The unit of work owns connect/begin/commit/rollback/release internally so the leak-safe transaction shape lives in one tested place — see [`/rules/04-repositories-and-persistence.md`](../rules/04-repositories-and-persistence.md) and [`/memory/reliability-patterns.md`](../memory/reliability-patterns.md).

---

## 10. Repository — ORM-agnostic, parameterized, bounded

Repositories only persist: find/save/update/delete/query, always parameterized, always bounded (hard max list limit 100). No business policy, no controller/service imports. The ORM (TypeORM / Prisma / Mongoose / Sequelize) is an interchangeable detail behind this boundary.

```ts
// src/modules/article/infrastructure/article.repository.ts
import { Injectable } from '@nestjs/common';

import { DataStore } from '@core/persistence/data-store';
import { clampLimit } from '@shared/utils/pagination.util';
import type { Article } from '../domain/article.entity';
import type { CreateArticleData, ListArticlesQuery } from '../model/article.types';

@Injectable()
export class ArticleRepository {
  constructor(private readonly store: DataStore<Article>) {}

  findById(id: string): Promise<Article | null> {
    return this.store.findOne({ where: { id } });
  }

  create(data: CreateArticleData): Promise<Article> {
    return this.store.insert(data);
  }

  list(query: ListArticlesQuery): Promise<readonly Article[]> {
    return this.store.find({
      where: { ownerId: query.ownerId },
      take: clampLimit(query.limit),
      skip: query.offset,
    });
  }
}
```

> `clampLimit` enforces the 100-cap; every list is paginated. Swap the ORM by changing only `DataStore`. See [`/rules/08-database-and-injection-safety.md`](../rules/08-database-and-injection-safety.md) and [`/skills/create-repository.md`](../skills/create-repository.md).

---

## 11. Module wiring + public surface

The module wires controllers + providers and declares its public surface via `index.ts`. Other modules import only through `index.ts` — never reach into internals.

```ts
// src/modules/article/article.module.ts
import { Module } from '@nestjs/common';

import { ArticleController } from './api/article.controller';
import { ArticleService } from './application/article.service';
import { PublishArticleUseCase } from './application/publish-article.use-case';
import { ArticleRepository } from './infrastructure/article.repository';

@Module({
  controllers: [ArticleController],
  providers: [ArticleService, PublishArticleUseCase, ArticleRepository],
  exports: [ArticleService],
})
export class ArticleModule {}
```

```ts
// src/modules/article/index.ts  (public surface — what other modules may import)
export { ArticleModule } from './article.module';
export { ArticleService } from './application/article.service';
export type { ArticleResponseDto } from './api/dto/article-response.dto';
```

> See [`/skills/create-module.md`](../skills/create-module.md) and [`/rules/01-architecture-and-module-boundaries.md`](../rules/01-architecture-and-module-boundaries.md).

---

## 12. Guards + `@RequirePermissions` decorator

Every protected route chains an auth guard → a permissions (RBAC) guard → an ownership/tenant check. Identity comes from the verified token; the permissions guard reads required permissions from decorator metadata.

```ts
// src/core/decorators/require-permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';

import { REQUIRE_PERMISSIONS_KEY } from '@core/guards/guard.constants';
import type { Permission } from '@shared/enums';

export function RequirePermissions(
  ...permissions: readonly Permission[]
): MethodDecorator {
  return SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
}
```

```ts
// src/core/guards/permissions.guard.ts
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { REQUIRE_PERMISSIONS_KEY } from './guard.constants';
import { ForbiddenError } from '@core/errors/forbidden.error';
import { FORBIDDEN_KEY } from './guard.constants';
import { hasAllPermissions } from './permission.helper';
import type { Permission } from '@shared/enums';
import type { AuthenticatedUser } from '@shared/types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<readonly Permission[]>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (required === undefined || required.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = request.user as AuthenticatedUser | undefined;
    if (user === undefined || !hasAllPermissions(user, required)) {
      throw new ForbiddenError('Missing required permissions', FORBIDDEN_KEY);
    }
    return true;
  }
}
```

> The `AuthGuard` runs first and attaches the verified `user`. See [`/rules/07-security-authn-authz.md`](../rules/07-security-authn-authz.md), [`/skills/add-guard-and-permission.md`](../skills/add-guard-and-permission.md), and reviewer [`/agents/backend-security-reviewer.md`](../agents/backend-security-reviewer.md).

---

## 13. Outbound adapter — wrap every external library

Wrap each external library/SDK behind a typed, app-owned interface. Business code depends on the port, never the vendor. Centralizes config, error mapping, retries, and test doubles; only adapters may import the vendor (lint-enforced).

```ts
// src/core/email/email.port.ts
import type { SendEmailCommand } from './email.types';

export interface EmailPort {
  send(command: SendEmailCommand): Promise<void>;
}

export const EMAIL_PORT = Symbol('EMAIL_PORT');
```

```ts
// src/adapters/email/provider-email.adapter.ts  (the ONLY place the vendor SDK is imported)
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { ProviderClient } from 'email-provider-sdk';

import { IntegrationError } from '@core/errors/integration.error';
import { EMAIL_SEND_FAILED_KEY } from './email-adapter.constants';
import { toProviderPayload } from './email-payload.mapper';
import type { EmailPort } from '@core/email/email.port';
import type { SendEmailCommand } from '@core/email/email.types';
import type { AppConfig } from '@config/app.config';

@Injectable()
export class ProviderEmailAdapter implements EmailPort {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async send(command: SendEmailCommand): Promise<void> {
    try {
      const payload = toProviderPayload(command);
      await Promise.resolve(payload); // replace with the wrapped SDK call
    } catch (cause) {
      throw new IntegrationError('Email send failed', EMAIL_SEND_FAILED_KEY, { cause });
    }
  }
}
```

> Bind the port to the adapter in a module: `{ provide: EMAIL_PORT, useClass: ProviderEmailAdapter }`. See [`/rules/12-library-wrapping-and-adapters.md`](../rules/12-library-wrapping-and-adapters.md) and [`/skills/add-library-adapter.md`](../skills/add-library-adapter.md).

---

## 14. Unit spec — Vitest + `@nestjs/testing`

Write/adjust tests first. Build the unit under test with `Test.createTestingModule`, mock at the boundary (repository/adapter ports), and assert behavior including the failure path. Coverage floor 95%; critical paths near 100%.

```ts
// src/modules/article/application/article.service.spec.ts
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ArticleService } from './article.service';
import { ArticleRepository } from '../infrastructure/article.repository';
import { NotFoundError } from '@core/errors/not-found.error';
import { buildArticle, buildUser } from '@shared/testing/factories';

describe('ArticleService', () => {
  let service: ArticleService;
  const repo = { findById: vi.fn(), create: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ArticleService, { provide: ArticleRepository, useValue: repo }],
    }).compile();
    service = moduleRef.get(ArticleService);
  });

  it('returns the mapped article when it exists', async () => {
    const article = buildArticle({ id: 'a1' });
    repo.findById.mockResolvedValue(article);

    const result = await service.getById('a1', buildUser({ id: article.ownerId }));

    expect(result.id).toBe('a1');
    expect(repo.findById).toHaveBeenCalledWith('a1');
  });

  it('throws NotFoundError when the article is missing', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.getById('missing', buildUser())).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
```

> See [`/testing/unit-testing-standard.md`](../testing/unit-testing-standard.md), [`/testing/test-data-and-fixtures.md`](../testing/test-data-and-fixtures.md), and [`/skills/write-unit-tests.md`](../skills/write-unit-tests.md). For HTTP-level tests use `supertest` ([`/testing/e2e-testing-standard.md`](../testing/e2e-testing-standard.md)).

---

## Cross-reference table

| Concern | Snippet | Rule | Skill |
| --- | --- | --- | --- |
| Bootstrap | §1 | [02](../rules/02-controllers-and-http-transport.md) | — |
| Config | §2 | [17](../rules/17-configuration-and-environment.md) | [add-config-value](../skills/add-config-value.md) |
| Errors + filter | §3–4 | [18](../rules/18-error-handling-and-exceptions.md) | [create-error](../skills/create-error.md) |
| Logger | §5 | [14](../rules/14-observability-and-logging.md) | — |
| Controller | §6 | [02](../rules/02-controllers-and-http-transport.md) | [create-controller](../skills/create-controller.md) |
| DTO | §7 | [05](../rules/05-dto-and-validation.md) | [create-dto-validation](../skills/create-dto-validation.md) |
| Service | §8 | [03](../rules/03-application-services-and-use-cases.md) | [create-service](../skills/create-service.md) |
| Use case | §9 | [03](../rules/03-application-services-and-use-cases.md) | [create-use-case](../skills/create-use-case.md) |
| Repository | §10 | [04](../rules/04-repositories-and-persistence.md) | [create-repository](../skills/create-repository.md) |
| Module | §11 | [01](../rules/01-architecture-and-module-boundaries.md) | [create-module](../skills/create-module.md) |
| Guards | §12 | [07](../rules/07-security-authn-authz.md) | [add-guard-and-permission](../skills/add-guard-and-permission.md) |
| Adapter | §13 | [12](../rules/12-library-wrapping-and-adapters.md) | [add-library-adapter](../skills/add-library-adapter.md) |
| Unit spec | §14 | [11](../rules/11-testing-and-coverage.md) | [write-unit-tests](../skills/write-unit-tests.md) |

Before calling any of these done, run the quality gates:

```bash
npm run lint            # 0 errors AND 0 warnings
npm run typecheck       # tsgo --noEmit, project-wide
npm run test            # vitest
npm run test:coverage   # coverage thresholds met
npm run build           # compiles clean
```

Related: [`architecture-map.md`](./architecture-map.md) · [`codebase-navigation.md`](./codebase-navigation.md) · [`glossary.md`](./glossary.md) · [`stack-and-toolchain.md`](./stack-and-toolchain.md) · [`/rules/00-non-negotiable-rules.md`](../rules/00-non-negotiable-rules.md) · [`/memory/known-pitfalls.md`](../memory/known-pitfalls.md)
