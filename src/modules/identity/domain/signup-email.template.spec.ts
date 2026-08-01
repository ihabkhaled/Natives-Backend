import { describe, expect, it } from 'vitest';

import {
  renderSignupAdminNotificationEmail,
  renderSignupApprovedEmail,
  renderSignupPendingEmail,
  renderSignupRejectedEmail,
} from './signup-email.template';

const WEB = 'https://app.natives.test';

describe('signup email templates', () => {
  it('tells the applicant their request is awaiting approval, with no action link', () => {
    const message = renderSignupPendingEmail({
      applicantEmail: 'applicant@example.test',
      displayName: 'Sam',
      webBaseUrl: WEB,
    });

    expect(message.to).toBe('applicant@example.test');
    expect(message.body).toContain('Hello Sam,');
    expect(message.body).toContain('awaiting');
    expect(message.actionUrl).toBeNull();
  });

  it('notifies the admin inbox with the applicant details', () => {
    const message = renderSignupAdminNotificationEmail({
      applicantEmail: 'applicant@example.test',
      displayName: null,
      adminEmail: 'ops@natives.test',
    });

    expect(message.to).toBe('ops@natives.test');
    expect(message.body).toContain('applicant@example.test');
    expect(message.body).toContain('(not provided)');
  });

  it('points an approved applicant at the login page', () => {
    const message = renderSignupApprovedEmail({
      applicantEmail: 'applicant@example.test',
      displayName: 'Sam',
      webBaseUrl: WEB,
    });

    expect(message.actionUrl).toBe('https://app.natives.test/login');
    expect(message.body).toContain('approved');
  });

  it('tells a rejected applicant the request was declined, with no link', () => {
    const message = renderSignupRejectedEmail({
      applicantEmail: 'applicant@example.test',
      displayName: 'Sam',
      webBaseUrl: WEB,
    });

    expect(message.body).toContain('not approved');
    expect(message.actionUrl).toBeNull();
  });
});
