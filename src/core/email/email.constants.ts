export const CONSOLE_EMAIL_LOGGER_CONTEXT = 'ConsoleEmailSender';

export const CONSOLE_EMAIL_SENT_MESSAGE = 'Outbound email rendered to the log';

/**
 * Stated in every console-transport log line so an operator reading a redacted
 * action URL knows this is the configured stand-in, not a delivery failure, and
 * knows where the usable link is.
 */
export const CONSOLE_TRANSPORT_NOTICE =
  'EMAIL_PROVIDER=console: no message was handed to a mail provider. ' +
  'The one-time link is returned once in the invitation API response for ' +
  'manual delivery. Set EMAIL_PROVIDER to a real transport to send for real.';

export const SMTP_EMAIL_LOGGER_CONTEXT = 'SmtpEmailSender';

/**
 * Logged (and the send skipped) when the in-process throttle is saturated, so a
 * misbehaving caller cannot flood the provider and trip its own rate limits.
 */
export const SMTP_THROTTLE_EXCEEDED_MESSAGE =
  'Outbound email skipped: the send throttle is saturated for this window';

// --- email:test CLI ---------------------------------------------------------
export const EMAIL_TEST_SUBJECT = 'Ultimate Natives email delivery test';

export const EMAIL_TEST_BODY =
  'This is a test message sent by `npm run email:test`. If you are reading it ' +
  'in a real inbox, the configured transport delivers end to end.';

export const EMAIL_TEST_MISSING_RECIPIENT_MESSAGE =
  'EMAIL_TO is not set — nowhere to send the test message';

export const EMAIL_TEST_SENT_PREFIX = 'email:test handed a message to';

export const EMAIL_TEST_FAILED_PREFIX = 'email:test failed';
