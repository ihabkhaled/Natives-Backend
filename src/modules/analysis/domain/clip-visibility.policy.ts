import { ClipStatus, ClipVisibility } from '../model/analysis.enums';
import type { ClipViewer, VideoClipView } from '../model/analysis.types';

/**
 * Pure visibility rules for analysis clips (UN-505).
 *
 * Two independent gates decide what a caller sees:
 *
 *  1. `canViewClip` — may the clip appear at all? A coach (team analysis
 *     permission) sees every clip in their team; a player only ever sees a
 *     PUBLISHED clip, and only when it is addressed to them (tagged) or to the
 *     whole team. Draft, in-review, revised and archived clips never reach a
 *     player, so an unfinished coaching opinion cannot leak.
 *  2. `canReadComment` — may the caller read the written note? A `coach_only`
 *     comment is readable by coaches alone even when the clip itself is visible
 *     to the tagged player, which is exactly the "coach-only notes never leak"
 *     invariant.
 */
export function canViewClip(view: VideoClipView, viewer: ClipViewer): boolean {
  if (viewer.canReadTeamAnalysis) {
    return true;
  }
  if (view.clip.status !== ClipStatus.Published) {
    return false;
  }
  return isAddressedToViewer(view, viewer);
}

/** Whether a published clip is addressed to this viewer. */
export function isAddressedToViewer(
  view: VideoClipView,
  viewer: ClipViewer,
): boolean {
  if (view.clip.visibility === ClipVisibility.Team) {
    return true;
  }
  if (view.clip.visibility === ClipVisibility.CoachOnly) {
    return false;
  }
  return isTagged(view, viewer);
}

/** Whether the viewer holds one of the memberships the clip is about. */
export function isTagged(view: VideoClipView, viewer: ClipViewer): boolean {
  return viewer.membershipIds.some(membershipId =>
    view.membershipIds.includes(membershipId),
  );
}

/** Whether the caller may read the clip's written note. */
export function canReadComment(
  view: VideoClipView,
  viewer: ClipViewer,
): boolean {
  if (viewer.canReadTeamAnalysis) {
    return true;
  }
  return view.clip.visibility !== ClipVisibility.CoachOnly;
}

/**
 * Redact the note when the caller may not read it. Redaction returns null — the
 * honest "you were not shown this", never an empty string that reads as "the
 * coach wrote nothing".
 */
export function applyCommentVisibility(
  view: VideoClipView,
  viewer: ClipViewer,
): VideoClipView {
  if (canReadComment(view, viewer)) {
    return view;
  }
  return { ...view, clip: { ...view.clip, comment: null } };
}

/** Whether a member may acknowledge the clip (published and addressed to them). */
export function canAcknowledgeClip(
  view: VideoClipView,
  membershipId: string,
): boolean {
  if (view.clip.status !== ClipStatus.Published) {
    return false;
  }
  if (view.clip.visibility === ClipVisibility.CoachOnly) {
    return false;
  }
  return view.membershipIds.includes(membershipId);
}
