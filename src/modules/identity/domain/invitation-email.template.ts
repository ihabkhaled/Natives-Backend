import type { EmailMessage } from '@core/email/email-sender.port';

import {
  INVITATION_ACCEPT_PATH,
  INVITATION_EMAIL_SUBJECT,
  INVITATION_TOKEN_QUERY_PARAM,
} from '../model/invitation-email.constants';

export interface InvitationEmailInput {
  readonly email: string;
  readonly token: string;
  readonly expiresAt: Date;
  /** Origin of the web app the recipient opens — never this API's origin. */
  readonly webBaseUrl: string;
}

/**
 * Build the accept-invitation link. The token travels as a query parameter
 * because that is what the web app's accept-invitation screen reads.
 */
export function buildAcceptInvitationUrl(
  webBaseUrl: string,
  token: string,
): string {
  const url = new URL(INVITATION_ACCEPT_PATH, `${webBaseUrl}/`);
  url.searchParams.set(INVITATION_TOKEN_QUERY_PARAM, token);
  return url.toString();
}

/**
 * Render the invitation email. Pure: no transport, no clock, no I/O — the
 * caller supplies every value, so the same input always renders the same
 * message and the template is trivially testable.
 */
export function renderInvitationEmail(
  input: InvitationEmailInput,
): EmailMessage {
  const acceptUrl = buildAcceptInvitationUrl(input.webBaseUrl, input.token);
  return {
    to: input.email,
    subject: INVITATION_EMAIL_SUBJECT,
    body: buildBody(acceptUrl, input.expiresAt),
    actionUrl: acceptUrl,
  };
}

function buildBody(acceptUrl: string, expiresAt: Date): string {
  return [
    'You have been invited to Ultimate Natives.',
    '',
    'Open the link below to choose your own password and activate your account:',
    acceptUrl,
    '',
    `This link can be used once and expires on ${expiresAt.toISOString()}.`,
    'If you did not expect this invitation you can ignore this message.',
  ].join('\n');
}
