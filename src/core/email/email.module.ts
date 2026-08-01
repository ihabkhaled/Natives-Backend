import { AppConfigService } from '@config/app-config.service';
import { ClockModule } from '@core/clock/clock.module';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import { AppLogger } from '@core/logger';
import { Module } from '@nestjs/common';
import { EmailProvider } from '@shared/enums';

import { ConsoleEmailSenderService } from './console-email-sender.service';
import type { EmailSenderPort } from './email-sender.port';
import { EMAIL_SENDER_PORT } from './email-sender.port';
import type { MailTransportOptions } from './mail-transport.port';
import { NodemailerTransportAdapter } from './nodemailer.adapter';
import { SmtpEmailSenderService } from './smtp-email-sender.service';

/**
 * The single place an outbound-email transport is chosen. Adding a real
 * provider is a one-file change here plus its adapter: implement
 * `EmailSenderPort`, add the enum member, and extend `selectSender`. No use
 * case, controller, or test that sends mail changes, because none of them name
 * a transport — they depend on `EMAIL_SENDER_PORT` only.
 *
 * See docs/product/open-decisions.md (OD-002) for the swap procedure.
 */
@Module({
  imports: [ClockModule],
  providers: [
    ConsoleEmailSenderService,
    {
      provide: EMAIL_SENDER_PORT,
      inject: [
        AppConfigService,
        ConsoleEmailSenderService,
        AppLogger,
        CLOCK_PORT,
      ],
      useFactory: selectSender,
    },
  ],
  exports: [EMAIL_SENDER_PORT],
})
export class EmailModule {}

/**
 * The console stand-in stays bound unless SMTP is both selected and enabled.
 * When it is, the nodemailer adapter is built once from typed config and wrapped
 * by `SmtpEmailSenderService` — the vendor is confined to the adapter and the
 * throttle/fallback logic to the service.
 */
export function selectSender(
  config: AppConfigService,
  consoleSender: ConsoleEmailSenderService,
  logger: AppLogger,
  clock: ClockPort,
): EmailSenderPort {
  const email = config.email;
  if (email.provider !== EmailProvider.Smtp || !email.enabled) {
    return consoleSender;
  }
  const adapter = new NodemailerTransportAdapter(toTransportOptions(config));
  return new SmtpEmailSenderService(
    adapter,
    config,
    consoleSender,
    logger,
    clock,
  );
}

function toTransportOptions(config: AppConfigService): MailTransportOptions {
  const smtp = config.email.smtp;
  return {
    host: smtp.host ?? '',
    port: smtp.port,
    secure: smtp.secure,
    auth:
      smtp.user !== undefined && smtp.pass !== undefined
        ? { user: smtp.user, pass: smtp.pass }
        : undefined,
  };
}
