/** Web-app route an approved applicant is pointed at to sign in. */
export const SIGNUP_LOGIN_PATH = 'login';

export const SIGNUP_APPLICANT_PENDING_SUBJECT =
  'We received your Ultimate Natives sign-up';

export const SIGNUP_ADMIN_NOTIFICATION_SUBJECT =
  'A new Ultimate Natives sign-up needs review';

export const SIGNUP_APPROVED_SUBJECT = 'Your Ultimate Natives account is ready';

export const SIGNUP_REJECTED_SUBJECT = 'Your Ultimate Natives sign-up';

export const SIGNUP_EMAIL_LOGGER_CONTEXT = 'SendSignupEmail';

export const SIGNUP_EMAIL_FAILED_MESSAGE =
  'A signup notification email could not be handed to the transport; the ' +
  'signup itself stands and its state is unchanged';
