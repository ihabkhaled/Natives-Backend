import { ForbiddenError } from '@core/errors/forbidden.error';

import {
  RBAC_ESCALATION_DENIED_MESSAGE,
  RBAC_ESCALATION_DENIED_MESSAGE_KEY,
} from '../model/rbac.constants';

/**
 * Raised when an actor attempts to grant or revoke a role whose permissions
 * exceed the actor's own within the target scope (privilege escalation). Maps to
 * a 403 with a generic message key — no capability detail is disclosed.
 */
export class EscalationDeniedError extends ForbiddenError {
  constructor() {
    super(RBAC_ESCALATION_DENIED_MESSAGE, RBAC_ESCALATION_DENIED_MESSAGE_KEY);
  }
}
