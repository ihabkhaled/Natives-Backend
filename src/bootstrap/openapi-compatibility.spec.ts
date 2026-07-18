import { classifyOpenApiChange } from './openapi-compatibility';
import { OpenApiChangeKind } from './openapi-compatibility.enums';
import type { OpenApiDocument } from './openapi-document.types';

const baseDocument = {
  openapi: '3.0.0',
  info: { title: 'API', version: '1.0.0' },
  paths: {
    '/auth/login': {
      post: {
        operationId: 'Auth.login',
        responses: { 200: { description: 'Session issued' } },
      },
    },
  },
  components: {
    schemas: {
      Role: { type: 'string', enum: ['member', 'coach'] },
    },
  },
} as OpenApiDocument;

describe('OpenAPI compatibility classifier', () => {
  it('classifies an added operation as additive', () => {
    const current = structuredClone(baseDocument);
    current.paths['/health'] = {
      get: {
        operationId: 'Health.readiness',
        responses: { 200: { description: 'Ready' } },
      },
    };

    expect(classifyOpenApiChange(baseDocument, current)).toMatchObject({
      kind: OpenApiChangeKind.Additive,
      breaking: false,
    });
  });

  it('classifies endpoint removal as breaking', () => {
    const current = structuredClone(baseDocument);
    delete current.paths['/auth/login'];

    expect(classifyOpenApiChange(baseDocument, current)).toMatchObject({
      kind: OpenApiChangeKind.Breaking,
      breaking: true,
    });
  });

  it('classifies an added response as additive', () => {
    const current = structuredClone(baseDocument);
    const login = current.paths['/auth/login']?.post;
    if (login !== undefined) {
      login.responses = {
        ...login.responses,
        409: { description: 'Current state changed' },
      };
    }

    const report = classifyOpenApiChange(baseDocument, current);

    expect(report).toMatchObject({
      kind: OpenApiChangeKind.Additive,
      breaking: false,
    });
    expect(report.reasons).toContain(
      'Added response 409 to operation: POST /auth/login',
    );
  });

  it('classifies a removed response as breaking', () => {
    const current = structuredClone(baseDocument);
    const login = current.paths['/auth/login']?.post;
    if (login !== undefined) {
      login.responses = {};
    }

    expect(classifyOpenApiChange(baseDocument, current)).toMatchObject({
      kind: OpenApiChangeKind.Breaking,
      breaking: true,
    });
  });

  it('classifies a changed response contract as breaking', () => {
    const current = structuredClone(baseDocument);
    const login = current.paths['/auth/login']?.post;
    if (login !== undefined) {
      login.responses = {
        200: {
          description: 'Session issued',
          content: { 'application/json': { schema: { type: 'string' } } },
        },
      };
    }

    const report = classifyOpenApiChange(baseDocument, current);

    expect(report).toMatchObject({
      kind: OpenApiChangeKind.Breaking,
      breaking: true,
    });
    expect(report.reasons).toContain(
      'Changed response 200 on operation: POST /auth/login',
    );
  });

  it('classifies an enum contraction as breaking', () => {
    const current = structuredClone(baseDocument);
    current.components = {
      schemas: {
        Role: { type: 'string', enum: ['member'] },
      },
    };

    const report = classifyOpenApiChange(baseDocument, current);

    expect(report.kind).toBe(OpenApiChangeKind.Breaking);
    expect(report.reasons).toContain('Changed existing schema: Role');
  });

  it('classifies documentation-only changes as behavioral', () => {
    const current = structuredClone(baseDocument);
    const login = current.paths['/auth/login']?.post;
    if (login !== undefined) {
      login.summary = 'Sign in';
    }

    expect(classifyOpenApiChange(baseDocument, current)).toMatchObject({
      kind: OpenApiChangeKind.Behavioral,
      breaking: false,
    });
  });

  it('classifies a newly deprecated operation as deprecated', () => {
    const current = structuredClone(baseDocument);
    const login = current.paths['/auth/login']?.post;
    if (login !== undefined) {
      login.deprecated = true;
    }

    expect(classifyOpenApiChange(baseDocument, current)).toMatchObject({
      kind: OpenApiChangeKind.Deprecated,
      breaking: false,
    });
  });

  it('classifies byte-equivalent documents as unchanged', () => {
    expect(
      classifyOpenApiChange(baseDocument, structuredClone(baseDocument)),
    ).toMatchObject({
      kind: OpenApiChangeKind.Unchanged,
      breaking: false,
      reasons: [],
    });
  });
});
