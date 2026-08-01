import { AppConfigService } from '@config/app-config.service';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '@/app.module';

import {
  EMAIL_TEST_BODY,
  EMAIL_TEST_FAILED_PREFIX,
  EMAIL_TEST_MISSING_RECIPIENT_MESSAGE,
  EMAIL_TEST_SENT_PREFIX,
  EMAIL_TEST_SUBJECT,
} from './email.constants';
import type { EmailSenderPort } from './email-sender.port';
import { EMAIL_SENDER_PORT } from './email-sender.port';

/**
 * Sends one message through the configured provider to EMAIL_TO so an operator
 * can confirm real delivery. It resolves the exact same `EmailSenderPort` the
 * application uses, so a green run proves the production wiring — not a bespoke
 * mailer. With EMAIL_PROVIDER=console (or EMAIL_ENABLED=false) it renders to the
 * log instead of a mailbox, which is still a valid pass for those modes.
 */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    abortOnError: false,
    logger: ['error', 'warn'],
  });
  try {
    const config = app.get(AppConfigService);
    const recipient = config.email.toAddress;
    if (recipient === undefined) {
      throw new Error(EMAIL_TEST_MISSING_RECIPIENT_MESSAGE);
    }
    const sender = app.get<EmailSenderPort>(EMAIL_SENDER_PORT);
    await sender.send({
      to: recipient,
      subject: EMAIL_TEST_SUBJECT,
      body: EMAIL_TEST_BODY,
      actionUrl: null,
    });
    process.stdout.write(
      `${EMAIL_TEST_SENT_PREFIX} ${recipient} via ${config.email.provider} (enabled=${String(config.email.enabled)})\n`,
    );
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${EMAIL_TEST_FAILED_PREFIX}: ${detail}\n`);
  process.exitCode = 1;
});
