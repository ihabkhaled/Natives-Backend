import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createApp } from '../src/bootstrap/create-app';
import {
  hashOpenApiArtifact,
  serializeOpenApiDocument,
} from '../src/bootstrap/openapi-artifact';
import { createOpenApiDocument } from '../src/bootstrap/openapi-document';
import {
  collectSchemaReferences,
  extractExportedClassNames,
  findDuplicateNames,
} from '../src/bootstrap/openapi-schema-names';

const OPENAPI_ARTIFACT_PATH = resolve('contracts/openapi.json');
const OPENAPI_CHECKSUM_PATH = resolve('contracts/openapi.sha256');
// Every DTO source in the repository, loaded at build time (no dynamic fs
// paths). Swagger names each schema after its DTO CLASS, so this is the set the
// duplicate-name guard below inspects.
const DTO_SOURCES = import.meta.glob('../src/modules/**/*.dto.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function declaredDtoClassNames(): readonly string[] {
  return Object.values(DTO_SOURCES).flatMap(source =>
    extractExportedClassNames(source),
  );
}

describe('canonical OpenAPI contract (e2e)', () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates byte-identical artifacts from the real application', () => {
    const first = serializeOpenApiDocument(createOpenApiDocument(app));
    const second = serializeOpenApiDocument(createOpenApiDocument(app));

    expect(first).toBe(second);
  });

  it('matches the committed contract and checksum', async () => {
    const generated = serializeOpenApiDocument(createOpenApiDocument(app));
    const [artifact, checksum] = await Promise.all([
      readFile(OPENAPI_ARTIFACT_PATH, 'utf8'),
      readFile(OPENAPI_CHECKSUM_PATH, 'utf8'),
    ]);

    expect(generated).toBe(artifact);
    expect(hashOpenApiArtifact(artifact)).toBe(checksum.trim());
  });

  it('declares every DTO class name exactly once across all modules', () => {
    // Swagger names each schema after its DTO CLASS, so two classes sharing a
    // name collapse into ONE `components.schemas` entry: the contract then
    // carries the wrong shape for the loser and every generated client is
    // silently wrong (NestJS logs "Duplicate DTO detected" and will throw in
    // its next major). This is the guard that keeps that from coming back.
    const names = declaredDtoClassNames();

    expect(names.length).toBeGreaterThan(0);
    expect(findDuplicateNames(names)).toEqual([]);
  });

  it('resolves every schema reference and shadows no DTO name', () => {
    // Two DTO classes sharing a name collapse into ONE `components.schemas`
    // entry, so the contract silently carries the wrong shape for the loser and
    // every generated client is wrong. The source-level guard lives in
    // src/bootstrap/openapi-schema-names.spec.ts; this asserts the published
    // document is internally consistent — every $ref target actually exists.
    const document = createOpenApiDocument(app);
    const defined = new Set(Object.keys(document.components?.schemas ?? {}));
    const referenced = collectSchemaReferences(document);

    expect(defined.size).toBeGreaterThan(0);
    expect(referenced.filter(name => !defined.has(name))).toEqual([]);
    for (const name of [
      'TeamTransitionDto',
      'MemberTransitionDto',
      'PointsListRulesResponseDto',
      'ScoringListRulesResponseDto',
      'MeasurementListSessionsResponseDto',
      'PracticeListSessionsResponseDto',
      'PracticeRosterEntryResponseDto',
      'CompetitionRosterEntryResponseDto',
      'AssignableRolesResponseDto',
      'SuperAdminEntryDto',
      'SuperAdminListResponseDto',
      'DeadLetterListResponseDto',
      'JobHealthListResponseDto',
    ]) {
      expect(defined.has(name)).toBe(true);
    }
  });

  it('describes the P1 onboarding and operations surfaces', () => {
    const document = createOpenApiDocument(app);

    expect(
      document.paths['/rbac/teams/{teamId}/assignable-roles']?.get?.responses,
    ).toHaveProperty('200');
    expect(
      document.paths['/rbac/platform/super-admins']?.post?.responses,
    ).toHaveProperty('201');
    expect(
      document.paths['/rbac/platform/super-admins']?.post?.responses,
    ).toHaveProperty('409');
    expect(
      document.paths['/rbac/platform/super-admins/{userId}']?.delete?.responses,
    ).toHaveProperty('409');
    expect(
      document.paths['/admin/outbox/dead-letters']?.get?.responses,
    ).toHaveProperty('200');
    expect(document.paths['/admin/jobs/health']?.get?.responses).toHaveProperty(
      '200',
    );
    // Invite-with-role: the request field is optional with a slug example.
    expect(document.components?.schemas?.['CreateTeamInvitationDto']).toEqual(
      expect.objectContaining({
        required: ['email'],
        properties: expect.objectContaining({
          teamRole: expect.objectContaining({ example: 'coach' }),
        }),
      }),
    );
  });

  it('publishes unique operation IDs and representative schemas', () => {
    const document = createOpenApiDocument(app);
    const operationIds = Object.values(document.paths).flatMap(path =>
      Object.values(path)
        .map(operation => operation.operationId)
        .filter((operationId): operationId is string => Boolean(operationId)),
    );

    expect(new Set(operationIds).size).toBe(operationIds.length);
    expect(operationIds).toContain('Auth.login');
    expect(operationIds).toContain('PracticeSessions.list');
    expect(document.paths['/auth/login']?.post?.responses).toHaveProperty(
      '200',
    );
    expect(document.components?.schemas?.['AuthSessionResponseDto']).toEqual(
      expect.objectContaining({
        properties: expect.objectContaining({
          accessToken: expect.objectContaining({ type: 'string' }),
          refreshToken: expect.objectContaining({ type: 'string' }),
        }),
      }),
    );
    expect(document.paths['/auth/login']?.post?.security).toEqual([{}]);
    expect(
      document.paths['/teams/{teamId}/practice-sessions']?.get?.parameters,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ in: 'path', name: 'teamId', required: true }),
      ]),
    );
    expect(
      document.paths['/teams/{teamId}/practice-sessions/{sessionId}/rsvp']?.put
        ?.responses,
    ).toHaveProperty('409');
    expect(document.security).toEqual([{ jwt: [] }]);
    expect(document.components?.securitySchemes).toHaveProperty('jwt');
  });
});
