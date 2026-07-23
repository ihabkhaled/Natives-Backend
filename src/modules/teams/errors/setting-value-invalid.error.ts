import { ValidationError } from '@core/errors/validation.error';
import type { ValidationIssue } from '@core/validation';

import {
  SETTING_VALUE_INVALID_MESSAGE,
  SETTING_VALUE_INVALID_MESSAGE_KEY,
} from '../model/teams.constants';

function describeIssues(issues: readonly ValidationIssue[]): string {
  const details = issues
    .map(issue => `${issue.field} ${issue.constraint}`)
    .join('; ');
  return details.length === 0
    ? SETTING_VALUE_INVALID_MESSAGE
    : `${SETTING_VALUE_INVALID_MESSAGE}: ${details}`;
}

/**
 * Raised when a setting value fails its per-key domain contract (P2, D1) or a
 * cross-setting reference check (D3). The field/constraint issues are embedded
 * in the sanitized message — they describe only the caller's own payload, never
 * server internals — so admins see exactly which rule rejected the document.
 */
export class SettingValueInvalidError extends ValidationError {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(describeIssues(issues), SETTING_VALUE_INVALID_MESSAGE_KEY);
    this.issues = issues;
  }
}
