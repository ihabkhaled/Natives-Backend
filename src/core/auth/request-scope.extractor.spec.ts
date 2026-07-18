import { describe, expect, it } from 'vitest';

import type { AuthRequest } from './auth.types';
import { extractRequestScope } from './request-scope.extractor';

function request(partial: Partial<AuthRequest>): AuthRequest {
  return { headers: {}, ...partial };
}

describe('extractRequestScope', () => {
  it('reads team and season from path params', () => {
    expect(
      extractRequestScope(
        request({ params: { teamId: 'team-1', seasonId: 'season-1' } }),
      ),
    ).toEqual({ teamId: 'team-1', seasonId: 'season-1' });
  });

  it('falls back to the query when a param is absent', () => {
    expect(
      extractRequestScope(request({ query: { teamId: 'team-2' } })),
    ).toEqual({ teamId: 'team-2' });
  });

  it('prefers a path param over a query value', () => {
    expect(
      extractRequestScope(
        request({ params: { teamId: 'param' }, query: { teamId: 'query' } }),
      ),
    ).toEqual({ teamId: 'param' });
  });

  it('ignores blank and non-string values', () => {
    expect(
      extractRequestScope(request({ params: { teamId: '', seasonId: 42 } })),
    ).toEqual({});
  });

  it('returns an empty scope when nothing is present', () => {
    expect(extractRequestScope(request({}))).toEqual({});
  });
});
