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
