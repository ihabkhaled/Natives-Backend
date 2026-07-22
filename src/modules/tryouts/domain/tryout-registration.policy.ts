import {
  CandidateStatus,
  RegistrationRefusal,
  TryoutEventStatus,
} from '../model/tryouts.enums';
import type { RegistrationVerdict, TryoutEvent } from '../model/tryouts.types';

/**
 * Pure registration rules for a tryout event (UN-600).
 *
 * A registration is accepted only when the event is OPEN, the instant falls
 * inside the published window, and the registrant accepted the exact consent
 * version the event requires — an older consent text is a refusal, never a
 * silent upgrade. Capacity does not refuse anyone: once the seats are taken the
 * registrant is WAITLISTED, which is a different, recoverable outcome.
 */
export function evaluateRegistration(
  event: TryoutEvent,
  consentVersion: string,
  registeredCount: number,
  now: Date,
): RegistrationVerdict {
  if (event.status !== TryoutEventStatus.Open) {
    return refuse(RegistrationRefusal.EventNotOpen);
  }
  if (!isWithinWindow(event, now)) {
    return refuse(RegistrationRefusal.WindowClosed);
  }
  if (event.consentVersion !== consentVersion) {
    return refuse(RegistrationRefusal.ConsentVersionMismatch);
  }
  return {
    accepted: true,
    refusal: null,
    waitlisted: isAtCapacity(event, registeredCount),
  };
}

export function isWithinWindow(event: TryoutEvent, now: Date): boolean {
  return (
    now.getTime() >= event.registrationOpensAt.getTime() &&
    now.getTime() < event.registrationClosesAt.getTime()
  );
}

/** A null capacity means "no seat limit", never "no seats". */
export function isAtCapacity(
  event: TryoutEvent,
  registeredCount: number,
): boolean {
  if (event.capacity === null) {
    return false;
  }
  return registeredCount >= event.capacity;
}

/** The status a newly accepted registration lands in. */
export function initialStatusOf(verdict: RegistrationVerdict): CandidateStatus {
  return verdict.waitlisted
    ? CandidateStatus.Waitlisted
    : CandidateStatus.Registered;
}

/** The 1-based waitlist position, or null for a seated registrant. */
export function waitlistPositionOf(
  verdict: RegistrationVerdict,
  event: TryoutEvent,
  registeredCount: number,
): number | null {
  if (!verdict.waitlisted || event.capacity === null) {
    return null;
  }
  return registeredCount - event.capacity + 1;
}

/** The instant a candidate's personal data must be anonymized by. */
export function retentionExpiryOf(
  event: TryoutEvent,
  now: Date,
  millisecondsPerDay: number,
): Date {
  return new Date(now.getTime() + event.retentionDays * millisecondsPerDay);
}

function refuse(refusal: RegistrationRefusal): RegistrationVerdict {
  return { accepted: false, refusal, waitlisted: false };
}
