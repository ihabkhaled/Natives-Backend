import { AppConfigService } from '@config/app-config.service';
import { Module } from '@nestjs/common';
import { EmailProvider } from '@shared/enums';

import { ConsoleEmailSenderService } from './console-email-sender.service';
import type { EmailSenderPort } from './email-sender.port';
import { EMAIL_SENDER_PORT } from './email-sender.port';

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
  providers: [
    ConsoleEmailSenderService,
    {
      provide: EMAIL_SENDER_PORT,
      inject: [AppConfigService, ConsoleEmailSenderService],
      useFactory: selectSender,
    },
  ],
  exports: [EMAIL_SENDER_PORT],
})
export class EmailModule {}

/**
 * Transports as data, not conditionals: add a provider by adding one entry.
 * The lookup is deliberately partial so an out-of-enum value still resolves to
 * the console transport rather than leaving the port unbound.
 */
export function selectSender(
  config: AppConfigService,
  consoleSender: ConsoleEmailSenderService,
): EmailSenderPort {
  const byProvider: Partial<Record<EmailProvider, EmailSenderPort>> = {
    [EmailProvider.Console]: consoleSender,
  };
  return byProvider[config.email.provider] ?? consoleSender;
}
