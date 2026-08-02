import { AppConfigService } from '@config/app-config.service';
import type { ClockPort } from '@core/clock/clock.port';
import { AppLogger } from '@core/logger';
import { Injectable } from '@nestjs/common';

import { ConsoleEmailSenderService } from './console-email-sender.service';
import { EmailThrottledError } from './email-throttled.error';
import {
  SMTP_EMAIL_LOGGER_CONTEXT,
  SMTP_THROTTLE_EXCEEDED_MESSAGE,
} from './email.constants';
import type { EmailMessage, EmailSenderPort } from './email-sender.port';
import type { MailTransportPort } from './mail-transport.port';

/**
 * Delivers real mail through the SMTP transport. Bound to `EmailSenderPort` only
 * when `EMAIL_PROVIDER=smtp && EMAIL_ENABLED=true`; otherwise the console
 * stand-in is bound instead. When the master switch is off it delegates to the
 * console sender so a resolved call still means "handled somewhere observable".
 * A small in-process sliding-window throttle (EMAIL_RATE_LIMIT_MAX per
 * EMAIL_RATE_LIMIT_WINDOW_MS) protects the provider from a flood: once
 * saturated, `send` REJECTS with `EmailThrottledError` rather than resolving —
 * a caller whose contract promises delivery must see the failure, not a false
 * success. Fire-and-forget callers (signup/invitation notifications) already
 * wrap the call in their own try/catch and stay best-effort.
 */
@Injectable()
export class SmtpEmailSenderService implements EmailSenderPort {
  private readonly sentAtMs: number[] = [];

  constructor(
    private readonly transport: MailTransportPort,
    private readonly config: AppConfigService,
    private readonly consoleSender: ConsoleEmailSenderService,
    private readonly logger: AppLogger,
    private readonly clock: ClockPort,
  ) {
    this.logger.setContext(SMTP_EMAIL_LOGGER_CONTEXT);
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.config.email.enabled) {
      await this.consoleSender.send(message);
      return;
    }
    if (!this.acquireSlot()) {
      this.logger.warn(SMTP_THROTTLE_EXCEEDED_MESSAGE, { to: message.to });
      throw new EmailThrottledError();
    }
    await this.transport.sendMail({
      from: this.config.email.fromAddress,
      to: message.to,
      subject: message.subject,
      text: message.body,
      ...(message.replyTo === undefined ? {} : { replyTo: message.replyTo }),
    });
  }

  private acquireSlot(): boolean {
    const nowMs = this.clock.now().getTime();
    const cutoff = nowMs - this.config.email.rateLimitWindowMs;
    this.pruneBefore(cutoff);
    if (this.sentAtMs.length >= this.config.email.rateLimitMax) {
      return false;
    }
    this.sentAtMs.push(nowMs);
    return true;
  }

  private pruneBefore(cutoff: number): void {
    while (this.sentAtMs.length > 0 && (this.sentAtMs[0] ?? 0) <= cutoff) {
      this.sentAtMs.shift();
    }
  }
}
