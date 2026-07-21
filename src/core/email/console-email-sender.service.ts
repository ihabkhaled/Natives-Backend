import { Injectable } from '@nestjs/common';

import { AppLogger } from '../logger/app-logger.service';
import {
  CONSOLE_EMAIL_LOGGER_CONTEXT,
  CONSOLE_EMAIL_SENT_MESSAGE,
  CONSOLE_TRANSPORT_NOTICE,
} from './email.constants';
import type { EmailMessage, EmailSenderPort } from './email-sender.port';

/**
 * The default transport: renders the message into the structured log instead of
 * handing it to a provider. This is the OD-002 stand-in — it exists so the
 * invitation flow *always* sends, with no credential and no separate step, in
 * local development and CI.
 *
 * The message is logged through `AppLogger`, which sanitizes its context. That
 * sanitizer redacts `token=` assignments, so the one-time credential inside the
 * action URL is censored here rather than sitting in a log file — deliberately.
 * The live link is still returned once, to the authorized admin, in the
 * invitation API response; that response is the manual-delivery fallback while
 * this transport is bound. The notice below states that in the log itself so an
 * operator seeing a redacted link knows exactly where the real one is.
 */
@Injectable()
export class ConsoleEmailSenderService implements EmailSenderPort {
  constructor(private readonly logger: AppLogger) {
    this.logger.setContext(CONSOLE_EMAIL_LOGGER_CONTEXT);
  }

  send(message: EmailMessage): Promise<void> {
    this.logger.info(CONSOLE_EMAIL_SENT_MESSAGE, {
      to: message.to,
      subject: message.subject,
      body: message.body,
      actionUrl: message.actionUrl,
      notice: CONSOLE_TRANSPORT_NOTICE,
    });
    return Promise.resolve();
  }
}
