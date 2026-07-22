import { describe, expect, it } from 'vitest';

import {
  ClipStatus,
  ClipTimestampIssue,
  ClipTransition,
  ClipVisibility,
} from '../model/analysis.enums';
import type {
  ClipViewer,
  VideoClip,
  VideoClipView,
} from '../model/analysis.types';
import {
  canTransitionClip,
  isArchiveTarget,
  isEditableClip,
  isFinalizedClip,
  isPublishTarget,
  isReviewTarget,
  targetStatusOf,
} from './clip.state-machine';
import {
  evaluateClipWindow,
  exceedsDuration,
  lastSecond,
  toRecordingSecond,
} from './clip-timestamp.policy';
import {
  applyCommentVisibility,
  canAcknowledgeClip,
  canReadComment,
  canViewClip,
  isAddressedToViewer,
  isTagged,
} from './clip-visibility.policy';

function clip(overrides: Partial<VideoClip>): VideoClip {
  return {
    clipId: 'clip-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    sourceId: 'source-1',
    matchId: null,
    pointId: null,
    eventId: null,
    startSecond: 10,
    endSecond: 20,
    playContext: 'offense',
    clipType: 'do',
    title: 'Reset flow',
    comment: 'private coaching note',
    visibility: ClipVisibility.CoachOnly,
    status: ClipStatus.Published,
    revision: 1,
    supersedesClipId: null,
    importReference: null,
    recordVersion: 1,
    authorUserId: 'user-coach',
    reviewedBy: null,
    reviewedAt: null,
    publishedBy: null,
    publishedAt: null,
    archivedAt: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    ...overrides,
  } as VideoClip;
}

function view(
  overrides: Partial<VideoClip>,
  membershipIds: string[] = [],
): VideoClipView {
  return {
    clip: clip(overrides),
    tags: [],
    membershipIds,
    acknowledgedMembershipIds: [],
  };
}

const PLAYER: ClipViewer = {
  userId: 'user-player',
  canReadTeamAnalysis: false,
  membershipIds: ['member-1'],
};

const COACH: ClipViewer = {
  userId: 'user-coach',
  canReadTeamAnalysis: true,
  membershipIds: [],
};

describe('clip timestamp policy', () => {
  it('accepts a window inside a known duration', () => {
    expect(evaluateClipWindow({ startSecond: 10, endSecond: 20 }, 100)).toEqual(
      { valid: true, issue: null },
    );
  });

  it('rejects a negative start', () => {
    expect(
      evaluateClipWindow({ startSecond: -1, endSecond: 5 }, 100).issue,
    ).toBe(ClipTimestampIssue.NegativeStart);
  });

  it('rejects an end at or before the start', () => {
    expect(
      evaluateClipWindow({ startSecond: 30, endSecond: 30 }, 100).issue,
    ).toBe(ClipTimestampIssue.EndBeforeStart);
  });

  it('rejects a window running past a known duration', () => {
    expect(
      evaluateClipWindow({ startSecond: 90, endSecond: 130 }, 100).issue,
    ).toBe(ClipTimestampIssue.BeyondDuration);
  });

  it('treats an unknown duration as no upper bound, never as zero', () => {
    expect(
      evaluateClipWindow({ startSecond: 5000, endSecond: 5100 }, null),
    ).toEqual({ valid: true, issue: null });
    expect(exceedsDuration({ startSecond: 5000, endSecond: null }, null)).toBe(
      false,
    );
  });

  it('measures the window by its end, or its start when open ended', () => {
    expect(lastSecond({ startSecond: 10, endSecond: 40 })).toBe(40);
    expect(lastSecond({ startSecond: 10, endSecond: null })).toBe(10);
  });

  it('maps a match instant onto the recording, clamped at zero', () => {
    expect(toRecordingSecond(100, 30)).toBe(130);
    expect(toRecordingSecond(10, -60)).toBe(0);
  });
});

describe('clip visibility policy', () => {
  it('shows every clip in the team to an analyst', () => {
    expect(canViewClip(view({ status: ClipStatus.Draft }), COACH)).toBe(true);
  });

  it('never shows an unpublished clip to a player', () => {
    expect(
      canViewClip(
        view({ status: ClipStatus.Draft, visibility: ClipVisibility.Team }),
        PLAYER,
      ),
    ).toBe(false);
  });

  it('shows a published team clip to any player', () => {
    expect(canViewClip(view({ visibility: ClipVisibility.Team }), PLAYER)).toBe(
      true,
    );
  });

  it('shows a published tagged clip only to the tagged player', () => {
    const tagged = view({ visibility: ClipVisibility.TaggedPlayers }, [
      'member-1',
    ]);
    const other = view({ visibility: ClipVisibility.TaggedPlayers }, [
      'member-9',
    ]);
    expect(canViewClip(tagged, PLAYER)).toBe(true);
    expect(canViewClip(other, PLAYER)).toBe(false);
    expect(isAddressedToViewer(tagged, PLAYER)).toBe(true);
    expect(isTagged(other, PLAYER)).toBe(false);
  });

  it('never shows a coach-only clip to a player, even when tagged', () => {
    const coachOnly = view({ visibility: ClipVisibility.CoachOnly }, [
      'member-1',
    ]);
    expect(canViewClip(coachOnly, PLAYER)).toBe(false);
    expect(isAddressedToViewer(coachOnly, PLAYER)).toBe(false);
  });

  it('redacts a coach-only note to null rather than empty text', () => {
    const coachOnly = view({ visibility: ClipVisibility.CoachOnly }, [
      'member-1',
    ]);
    expect(canReadComment(coachOnly, PLAYER)).toBe(false);
    expect(applyCommentVisibility(coachOnly, PLAYER).clip.comment).toBeNull();
  });

  it('leaves the note intact for an analyst and a team clip', () => {
    const teamClip = view({ visibility: ClipVisibility.Team });
    expect(applyCommentVisibility(teamClip, COACH)).toBe(teamClip);
    expect(canReadComment(teamClip, PLAYER)).toBe(true);
    expect(applyCommentVisibility(teamClip, PLAYER)).toBe(teamClip);
  });

  it('allows acknowledgement only on a published clip addressed to the member', () => {
    expect(
      canAcknowledgeClip(
        view({ visibility: ClipVisibility.TaggedPlayers }, ['member-1']),
        'member-1',
      ),
    ).toBe(true);
    expect(
      canAcknowledgeClip(
        view(
          {
            visibility: ClipVisibility.TaggedPlayers,
            status: ClipStatus.Draft,
          },
          ['member-1'],
        ),
        'member-1',
      ),
    ).toBe(false);
    expect(
      canAcknowledgeClip(
        view({ visibility: ClipVisibility.CoachOnly }, ['member-1']),
        'member-1',
      ),
    ).toBe(false);
    expect(
      canAcknowledgeClip(view({ visibility: ClipVisibility.Team }, []), 'x'),
    ).toBe(false);
  });
});

describe('clip state machine', () => {
  it('maps each lifecycle verb to its target status', () => {
    expect(targetStatusOf(ClipTransition.Submit)).toBe(ClipStatus.InReview);
    expect(targetStatusOf(ClipTransition.Publish)).toBe(ClipStatus.Published);
    expect(targetStatusOf(ClipTransition.Archive)).toBe(ClipStatus.Archived);
  });

  it('allows the review path and refuses everything else', () => {
    expect(canTransitionClip(ClipStatus.Draft, ClipStatus.InReview)).toBe(true);
    expect(canTransitionClip(ClipStatus.Draft, ClipStatus.Published)).toBe(
      true,
    );
    expect(canTransitionClip(ClipStatus.InReview, ClipStatus.Published)).toBe(
      true,
    );
    expect(canTransitionClip(ClipStatus.Published, ClipStatus.Revised)).toBe(
      true,
    );
    expect(canTransitionClip(ClipStatus.Published, ClipStatus.InReview)).toBe(
      false,
    );
    expect(canTransitionClip(ClipStatus.Archived, ClipStatus.Published)).toBe(
      false,
    );
    expect(canTransitionClip(ClipStatus.Revised, ClipStatus.Published)).toBe(
      false,
    );
  });

  it('classifies editable, finalized, and target statuses', () => {
    expect(isEditableClip(ClipStatus.Draft)).toBe(true);
    expect(isEditableClip(ClipStatus.InReview)).toBe(true);
    expect(isEditableClip(ClipStatus.Published)).toBe(false);
    expect(isFinalizedClip(ClipStatus.Published)).toBe(true);
    expect(isFinalizedClip(ClipStatus.Draft)).toBe(false);
    expect(isPublishTarget(ClipStatus.Published)).toBe(true);
    expect(isReviewTarget(ClipStatus.InReview)).toBe(true);
    expect(isArchiveTarget(ClipStatus.Archived)).toBe(true);
    expect(isArchiveTarget(ClipStatus.Draft)).toBe(false);
  });
});
