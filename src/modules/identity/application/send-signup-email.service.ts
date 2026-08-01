import { AppConfigService } from '@config/app-config.service';
import {
  EMAIL_SENDER_PORT,
  type EmailMessage,
  type EmailSenderPort,
} from '@core/email';
import { AppLogger } from '@core/logger';
import { Inject, Injectable } from '@nestjs/common';

import {
  renderSignupAdminNotificationEmail,
  renderSignupApprovedEmail,
  renderSignupPendingEmail,
  renderSignupRejectedEmail,
} from '../domain/signup-email.template';
import type { SignupRequestSummary } from '../model/identity.types';
import {
  SIGNUP_EMAIL_FAILED_MESSAGE,
  SIGNUP_EMAIL_LOGGER_CONTEXT,
} from '../model/signup-email.constants';

/**
 * Sends the signup notification emails for signups that have already committed.
 * Called after the transaction: handing a message to a transport is not
 * rollback-able and delivery is best-effort by design — a transport outage must
 * never turn a persisted signup or a completed approval into a failed request.
 * Each failure is logged and swallowed.
 */
@Injectable()
export class SendSignupEmailService {
  constructor(
    @Inject(EMAIL_SENDER_PORT) private readonly sender: EmailSenderPort,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(SIGNUP_EMAIL_LOGGER_CONTEXT);
  }

  async sendPendingNotifications(signup: SignupRequestSummary): Promise<void> {
    await this.safeSend(
      renderSignupPendingEmail({
        applicantEmail: signup.email,
        displayName: signup.displayName,
        webBaseUrl: this.config.email.webBaseUrl,
      }),
      signup.id,
    );
    await this.notifyAdmin(signup);
  }

  async sendApproved(signup: SignupRequestSummary): Promise<void> {
    await this.safeSend(
      renderSignupApprovedEmail({
        applicantEmail: signup.email,
        displayName: signup.displayName,
        webBaseUrl: this.config.email.webBaseUrl,
      }),
      signup.id,
    );
  }

  async sendRejected(signup: SignupRequestSummary): Promise<void> {
    await this.safeSend(
      renderSignupRejectedEmail({
        applicantEmail: signup.email,
        displayName: signup.displayName,
        webBaseUrl: this.config.email.webBaseUrl,
      }),
      signup.id,
    );
  }

  private async notifyAdmin(signup: SignupRequestSummary): Promise<void> {
    const adminEmail = this.config.email.toAddress;
    if (adminEmail === undefined) {
      return;
    }
    await this.safeSend(
      renderSignupAdminNotificationEmail({
        applicantEmail: signup.email,
        displayName: signup.displayName,
        adminEmail,
      }),
      signup.id,
    );
  }

  private async safeSend(
    message: EmailMessage,
    signupId: string,
  ): Promise<void> {
    try {
      await this.sender.send(message);
    } catch (error) {
      this.logger.error(SIGNUP_EMAIL_FAILED_MESSAGE, { signupId, error });
    }
  }
}
