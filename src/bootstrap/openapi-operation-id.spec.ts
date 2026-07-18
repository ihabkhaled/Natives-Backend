import { createOpenApiOperationId } from './openapi-operation-id';

describe('OpenAPI operation ID', () => {
  it('uses the stable controller and method identity', () => {
    expect(createOpenApiOperationId('PracticeSessionsController', 'list')).toBe(
      'PracticeSessions.list',
    );
  });

  it('preserves a controller key that has no Controller suffix', () => {
    expect(createOpenApiOperationId('Health', 'readiness')).toBe(
      'Health.readiness',
    );
  });
});
