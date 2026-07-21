/** Web-app route the invitation link points at (relative to WEB_BASE_URL). */
export const INVITATION_ACCEPT_PATH = 'accept-invitation';

/** Query parameter the web app's accept-invitation screen reads the token from. */
export const INVITATION_TOKEN_QUERY_PARAM = 'token';

export const INVITATION_EMAIL_SUBJECT = 'Your Ultimate Natives invitation';

export const INVITATION_EMAIL_LOGGER_CONTEXT = 'SendInvitationEmail';

export const INVITATION_EMAIL_FAILED_MESSAGE =
  'Invitation email could not be handed to the transport; the invitation ' +
  'stands and its one-time link remains available for manual delivery';
