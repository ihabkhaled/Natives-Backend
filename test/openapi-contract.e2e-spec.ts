import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createApp } from '../src/bootstrap/create-app';
import {
  hashOpenApiArtifact,
  serializeOpenApiDocument,
} from '../src/bootstrap/openapi-artifact';
import { createOpenApiDocument } from '../src/bootstrap/openapi-document';

const OPENAPI_ARTIFACT_PATH = resolve('contracts/openapi.json');
const OPENAPI_CHECKSUM_PATH = resolve('contracts/openapi.sha256');

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
