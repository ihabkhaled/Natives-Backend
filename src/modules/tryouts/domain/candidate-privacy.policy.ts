import { ANONYMIZED_PLACEHOLDER } from '../model/tryouts.constants';
import { CandidateAudience, ContactChannel } from '../model/tryouts.enums';
import type { CandidateViewer, TryoutCandidate } from '../model/tryouts.types';

/**
 * Pure privacy rules for tryout candidates (UN-600).
 *
 * A candidate is an outsider who handed us personal data for one purpose, so the
 * default is minimum exposure:
 *
 *  - the CONTACT reference is readable only with `tryout.contacts.read`;
 *  - the READINESS classification and the restricted health notes are readable
 *    only with `tryout.readiness.read` — and the free-text note is never
 *    exposed to anyone below that tier;
 *  - a public view carries neither, and never the motivation text either.
 *
 * Redaction returns null, not an empty string: "you were not shown this" must
 * never read as "the candidate did not answer".
 */
export function redactCandidate(
  candidate: TryoutCandidate,
  viewer: CandidateViewer,
): TryoutCandidate {
  return {
    ...candidate,
    contactReference: viewer.canReadContacts
      ? candidate.contactReference
      : null,
    restrictedNotes: viewer.canReadReadiness ? candidate.restrictedNotes : null,
    motivation: isStaffAudience(viewer) ? candidate.motivation : null,
    priorSport: isStaffAudience(viewer) ? candidate.priorSport : null,
    referralSource: isStaffAudience(viewer) ? candidate.referralSource : null,
  };
}

export function isStaffAudience(viewer: CandidateViewer): boolean {
  return viewer.audience !== CandidateAudience.Public;
}

/** Whether the candidate volunteered any way of being contacted. */
export function hasContactChannel(candidate: TryoutCandidate): boolean {
  return candidate.contactChannel !== ContactChannel.None;
}

/**
 * Whether a candidate may be sent a communication: they must have a channel AND
 * have opted in. Consent is never assumed from the presence of an address.
 */
export function canContactCandidate(candidate: TryoutCandidate): boolean {
  return hasContactChannel(candidate) && candidate.communicationOptIn;
}

/** Whether the candidate's retention period has elapsed. */
export function isRetentionExpired(
  candidate: TryoutCandidate,
  now: Date,
): boolean {
  if (candidate.anonymizedAt !== null) {
    return false;
  }
  return candidate.retentionExpiresAt.getTime() <= now.getTime();
}

/**
 * The anonymized form of a candidate: every free-text personal field replaced,
 * the contact dropped, the health note dropped. Statuses and instants are kept
 * so the funnel statistics stay truthful after anonymization.
 */
export function anonymizeCandidate(
  candidate: TryoutCandidate,
  now: Date,
): TryoutCandidate {
  return {
    ...candidate,
    displayName: ANONYMIZED_PLACEHOLDER,
    contactChannel: ContactChannel.None,
    contactReference: null,
    priorSport: null,
    referralSource: null,
    motivation: null,
    restrictedNotes: null,
    communicationOptIn: false,
    anonymizedAt: now,
  };
}
