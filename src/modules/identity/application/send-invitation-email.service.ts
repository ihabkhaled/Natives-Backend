import { AppConfigService } from '@config/app-config.service';
import { EMAIL_SENDER_PORT, type EmailSenderPort } from '@core/email';
import { AppLogger } from '@core/logger';
import { Inject, Injectable } from '@nestjs/common';

import { renderInvitationEmail } from '../domain/invitation-email.template';
import type { InvitationDelivery } from '../model/identity.types';
import {
  INVITATION_EMAIL_FAILED_MESSAGE,
  INVITATION_EMAIL_LOGGER_CONTEXT,
} from '../model/invitation-email.constants';

/**
 * Sends the invitation email for a delivery that has already been committed.
 *
 * Called after the transaction, never inside it: handing a message to a
 * transport is not rollback-able, and a slow provider must not hold a database
 * transaction open.
 *
 * Delivery is best-effort by design. The invitation is already persisted and
 * the one-time link is already in the admin's response, so a transport outage
 * must not turn a successful invitation into a failed request. A failure is
 * logged and the admin falls back to handing the link over manually.
 */
@Injectable()
export class SendInvitationEmailService {
  constructor(
    @Inject(EMAIL_SENDER_PORT) private readonly sender: EmailSenderPort,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(INVITATION_EMAIL_LOGGER_CONTEXT);
  }

  async send(delivery: InvitationDelivery): Promise<void> {
    try {
      await this.sender.send(
        renderInvitationEmail({
          email: delivery.email,
          token: delivery.token,
          expiresAt: delivery.expiresAt,
          webBaseUrl: this.config.email.webBaseUrl,
        }),
      );
    } catch (error) {
      this.logger.error(INVITATION_EMAIL_FAILED_MESSAGE, {
        invitationId: delivery.id,
        error,
      });
    }
  }
}
