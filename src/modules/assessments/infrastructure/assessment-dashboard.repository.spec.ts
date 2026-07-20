import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ASSESSMENT_PUBLISHED_STATE,
  ASSESSMENT_SUBMITTED_STATE,
} from '../model/signals.constants';
import { AssessmentDashboardRepository } from './assessment-dashboard.repository';

describe('AssessmentDashboardRepository', () => {
  let repository: AssessmentDashboardRepository;
  let scope: { run: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = new AssessmentDashboardRepository();
    scope = { run: vi.fn().mockResolvedValue([]) };
  });

  it('counts only current published assessments for the member', async () => {
    await repository.countPublishedForMember(
      scope as never,
      'team-1',
      'membership-1',
    );

    expect(scope.run.mock.calls[0]?.[0]).toContain(
      '"a"."superseded_at" IS NULL',
    );
    expect(scope.run.mock.calls[0]?.[1]).toEqual([
      'team-1',
      'membership-1',
      ASSESSMENT_PUBLISHED_STATE,
    ]);
  });

  it('counts only current submitted assessments awaiting review', async () => {
    await repository.countAwaitingReview(scope as never, 'team-1');

    expect(scope.run.mock.calls[0]?.[1]).toEqual([
      'team-1',
      ASSESSMENT_SUBMITTED_STATE,
    ]);
  });
});
