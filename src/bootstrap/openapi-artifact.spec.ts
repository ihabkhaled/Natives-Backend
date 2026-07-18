import { createHash } from 'node:crypto';

import {
  hashOpenApiArtifact,
  serializeOpenApiDocument,
} from './openapi-artifact';
import type { OpenApiDocument } from './openapi-document.types';

describe('OpenAPI artifact', () => {
  it('serializes object keys deterministically and preserves array order', () => {
    const first = {
      openapi: '3.0.0',
      info: { version: '1.0.0', title: 'API' },
      paths: {
        '/z': { get: { tags: ['z', 'a'], responses: { 200: {} } } },
        '/a': { post: { responses: { 201: {} } } },
      },
    } as OpenApiDocument;
    const second = {
      paths: {
        '/a': { post: { responses: { 201: {} } } },
        '/z': { get: { responses: { 200: {} }, tags: ['z', 'a'] } },
      },
      info: { title: 'API', version: '1.0.0' },
      openapi: '3.0.0',
    } as OpenApiDocument;

    expect(serializeOpenApiDocument(first)).toBe(
      serializeOpenApiDocument(second),
    );
    expect(serializeOpenApiDocument(first)).toContain(
      '"tags": [\n          "z",\n          "a"\n        ]',
    );
    expect(serializeOpenApiDocument(first)).toMatch(/\n$/u);
  });

  it('returns the SHA-256 checksum of the exact serialized bytes', () => {
    const artifact = '{"openapi":"3.0.0"}\n';
    const expected = createHash('sha256').update(artifact).digest('hex');

    expect(hashOpenApiArtifact(artifact)).toBe(expected);
    expect(hashOpenApiArtifact(artifact)).toMatch(/^[a-f\d]{64}$/u);
  });
});
