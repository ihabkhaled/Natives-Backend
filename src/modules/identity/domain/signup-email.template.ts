import type { EmailMessage } from '@core/email';

import {
  SIGNUP_ADMIN_NOTIFICATION_SUBJECT,
  SIGNUP_APPLICANT_PENDING_SUBJECT,
  SIGNUP_APPROVED_SUBJECT,
  SIGNUP_LOGIN_PATH,
  SIGNUP_REJECTED_SUBJECT,
} from '../model/signup-email.constants';

/**
 * Inputs for the signup emails. Pure data — the caller resolves every value
 * (applicant address, operator inbox, web origin) so each renderer is
 * deterministic and trivially testable with no transport, clock, or I/O.
 */
export interface SignupEmailInput {
  readonly applicantEmail: string;
  readonly displayName: string | null;
  readonly webBaseUrl: string;
}

export interface SignupAdminEmailInput {
  readonly applicantEmail: string;
  readonly displayName: string | null;
  readonly adminEmail: string;
}

/** Applicant confirmation: their request is in and awaiting admin approval. */
export function renderSignupPendingEmail(
  input: SignupEmailInput,
): EmailMessage {
  return {
    to: input.applicantEmail,
    subject: SIGNUP_APPLICANT_PENDING_SUBJECT,
    body: [
      greeting(input.displayName),
      '',
      'Thanks for signing up to Ultimate Natives. Your request is now awaiting',
      'approval from an administrator. We will email you as soon as it is',
      'reviewed — there is nothing more you need to do right now.',
    ].join('\n'),
    actionUrl: null,
  };
}

/** Operator notification: a new signup is waiting in the review queue. */
export function renderSignupAdminNotificationEmail(
  input: SignupAdminEmailInput,
): EmailMessage {
  return {
    to: input.adminEmail,
    subject: SIGNUP_ADMIN_NOTIFICATION_SUBJECT,
    body: [
      'A new account sign-up is awaiting review:',
      '',
      `  Email: ${input.applicantEmail}`,
      `  Name:  ${input.displayName ?? '(not provided)'}`,
      '',
      'Approve or reject it from the admin signups queue.',
    ].join('\n'),
    actionUrl: null,
  };
}

/** Applicant approval: the account is active and can now sign in. */
export function renderSignupApprovedEmail(
  input: SignupEmailInput,
): EmailMessage {
  const loginUrl = buildLoginUrl(input.webBaseUrl);
  return {
    to: input.applicantEmail,
    subject: SIGNUP_APPROVED_SUBJECT,
    body: [
      greeting(input.displayName),
      '',
      'Good news — your Ultimate Natives account has been approved. You can',
      'sign in now:',
      loginUrl,
    ].join('\n'),
    actionUrl: loginUrl,
  };
}

/** Applicant rejection: the request was declined; the account stays inert. */
export function renderSignupRejectedEmail(
  input: SignupEmailInput,
): EmailMessage {
  return {
    to: input.applicantEmail,
    subject: SIGNUP_REJECTED_SUBJECT,
    body: [
      greeting(input.displayName),
      '',
      'Thank you for your interest in Ultimate Natives. After review, your',
      'sign-up request was not approved at this time. If you believe this is a',
      'mistake, please reach out to the team.',
    ].join('\n'),
    actionUrl: null,
  };
}

function buildLoginUrl(webBaseUrl: string): string {
  return new URL(SIGNUP_LOGIN_PATH, `${webBaseUrl}/`).toString();
}

function greeting(displayName: string | null): string {
  return displayName === null ? 'Hello,' : `Hello ${displayName},`;
}
