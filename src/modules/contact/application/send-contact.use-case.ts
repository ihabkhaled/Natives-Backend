import { AppConfigService } from '@config/app-config.service';
import { EMAIL_SENDER_PORT, type EmailSenderPort } from '@core/email';
import { Inject, Injectable } from '@nestjs/common';

import { ContactUnavailableError } from '../errors/contact-unavailable.error';
import { CONTACT_SUBJECT_PREFIX } from '../model/contact.constants';
import type {
  ContactSendResult,
  ContactSubmission,
} from '../model/contact.types';

/**
 * Relays a public contact-form submission to the operator inbox through the
 * shared email port — the only sink, nothing is persisted. The verified sender
 * (`EMAIL_FROM`) is always the `from`; the visitor's address is carried only as
 * Reply-To, never as the envelope sender. The body is plain text with no
 * template, so there is no injection surface. A delivery failure propagates as a
 * 5xx; a disabled or unconfigured channel is a clean 503. The visitor's address
 * and message are never logged here.
 */
@Injectable()
export class SendContactUseCase {
  constructor(
    @Inject(EMAIL_SENDER_PORT) private readonly sender: EmailSenderPort,
    private readonly config: AppConfigService,
  ) {}

  async execute(submission: ContactSubmission): Promise<ContactSendResult> {
    const email = this.config.email;
    if (!email.enabled || email.toAddress === undefined) {
      throw new ContactUnavailableError();
    }
    await this.sender.send({
      to: email.toAddress,
      subject: `${CONTACT_SUBJECT_PREFIX}${submission.subject}`,
      body: `From: ${submission.email}\n\n${submission.message}`,
      actionUrl: null,
      replyTo: submission.email,
    });
    return { sent: true };
  }
}
