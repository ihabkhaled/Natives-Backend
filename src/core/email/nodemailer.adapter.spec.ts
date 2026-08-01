import type { createTransport } from 'nodemailer';
import { describe, expect, it, vi } from 'vitest';

import { NodemailerTransportAdapter } from './nodemailer.adapter';

function fakeFactory() {
  const sendMail = vi.fn().mockResolvedValue(undefined);
  const factory = vi
    .fn()
    .mockReturnValue({ sendMail }) as unknown as typeof createTransport;
  return { factory, sendMail };
}

describe('NodemailerTransportAdapter', () => {
  it('builds the vendor transport from the given options', () => {
    const { factory } = fakeFactory();

    new NodemailerTransportAdapter(
      {
        host: 'smtp.test',
        port: 587,
        secure: false,
        auth: { user: 'u', pass: 'p' },
      },
      factory,
    );

    expect(factory).toHaveBeenCalledWith({
      host: 'smtp.test',
      port: 587,
      secure: false,
      auth: { user: 'u', pass: 'p' },
    });
  });

  it('forwards a message to the vendor transporter with hardening flags', async () => {
    const { factory, sendMail } = fakeFactory();
    const adapter = new NodemailerTransportAdapter(
      { host: 'smtp.test', port: 587, secure: false, auth: undefined },
      factory,
    );

    await adapter.sendMail({
      from: 'from@test',
      to: 'to@test',
      subject: 'hi',
      text: 'body',
    });

    expect(sendMail).toHaveBeenCalledWith({
      from: 'from@test',
      to: 'to@test',
      subject: 'hi',
      text: 'body',
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  });

  it('passes a Reply-To through only when supplied', async () => {
    const { factory, sendMail } = fakeFactory();
    const adapter = new NodemailerTransportAdapter(
      { host: 'smtp.test', port: 587, secure: false, auth: undefined },
      factory,
    );

    await adapter.sendMail({
      from: 'from@test',
      to: 'to@test',
      subject: 'hi',
      text: 'body',
      replyTo: 'visitor@test',
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: 'visitor@test' }),
    );
  });
});
