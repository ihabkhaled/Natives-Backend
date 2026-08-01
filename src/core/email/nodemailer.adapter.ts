import { createTransport, type Transporter } from 'nodemailer';

import type {
  MailSendInput,
  MailTransportOptions,
  MailTransportPort,
} from './mail-transport.port';

/**
 * The only file that imports nodemailer. It adapts the vendor's `Transporter`
 * to the app-owned `MailTransportPort`, so no provider type, option shape, or
 * error leaks past this seam (rule 12). The transport factory is injectable so
 * the adapter can be unit-tested against a fake transporter.
 */
export class NodemailerTransportAdapter implements MailTransportPort {
  private readonly transporter: Transporter;

  constructor(
    options: MailTransportOptions,
    factory: typeof createTransport = createTransport,
  ) {
    this.transporter = factory({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.auth,
    });
  }

  async sendMail(input: MailSendInput): Promise<void> {
    await this.transporter.sendMail({
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.replyTo === undefined ? {} : { replyTo: input.replyTo }),
      // Harden against message-generation SSRF/file exfiltration: a plain-text
      // body never needs to read local files or fetch remote URLs.
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }
}
