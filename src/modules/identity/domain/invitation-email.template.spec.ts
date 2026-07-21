import { describe, expect, it } from 'vitest';

import {
  buildAcceptInvitationUrl,
  renderInvitationEmail,
} from './invitation-email.template';

const EXPIRES_AT = new Date('2026-06-08T12:00:00.000Z');

const INPUT = {
  email: 'invitee@example.test',
  token: 'raw-token-value',
  expiresAt: EXPIRES_AT,
  webBaseUrl: 'http://localhost:5173',
};

describe('buildAcceptInvitationUrl', () => {
  it('points at the web app accept screen with the token as a query parameter', () => {
    expect(buildAcceptInvitationUrl('http://localhost:5173', 'abc123')).toBe(
      'http://localhost:5173/accept-invitation?token=abc123',
    );
  });

  it('percent-encodes a token so it survives the query string intact', () => {
    expect(buildAcceptInvitationUrl('https://app.test', 'a+b/c=d')).toBe(
      'https://app.test/accept-invitation?token=a%2Bb%2Fc%3Dd',
    );
  });

  it('keeps a base url that already carries a path prefix', () => {
    expect(buildAcceptInvitationUrl('https://app.test/natives', 'tok')).toBe(
      'https://app.test/natives/accept-invitation?token=tok',
    );
  });
});

describe('renderInvitationEmail', () => {
  it('addresses the invitee and carries the accept link as the action', () => {
    const message = renderInvitationEmail(INPUT);

    expect(message.to).toBe(INPUT.email);
    expect(message.subject).toContain('invitation');
    expect(message.actionUrl).toBe(
      'http://localhost:5173/accept-invitation?token=raw-token-value',
    );
  });

  it('puts the same link in the body so a plain-text client is usable', () => {
    const message = renderInvitationEmail(INPUT);

    expect(message.body).toContain(message.actionUrl);
  });

  it('states the expiry so the recipient knows the link is time-boxed', () => {
    expect(renderInvitationEmail(INPUT).body).toContain(
      EXPIRES_AT.toISOString(),
    );
  });

  it('renders deterministically from its input alone', () => {
    expect(renderInvitationEmail(INPUT)).toEqual(renderInvitationEmail(INPUT));
  });
});
