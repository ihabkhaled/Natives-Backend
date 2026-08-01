import { EmailModule } from '@core/email';
import { Module } from '@nestjs/common';

import { ContactController } from './api/contact.controller';
import { SendContactUseCase } from './application/send-contact.use-case';

/**
 * Public contact-form context. Stateless — no persistence, no repositories. It
 * reuses the shared EmailModule's `EmailSenderPort` as its only sink; the SMTP
 * adapter and throttle from the email module are not duplicated here.
 */
@Module({
  imports: [EmailModule],
  controllers: [ContactController],
  providers: [SendContactUseCase],
})
export class ContactModule {}
