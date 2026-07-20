import { CompetitionValidationError } from '../errors/competition-validation.error';
import type { CompetitionContent } from '../model/competitions.types';

/**
 * Pure content invariants for a competition: when both a start and end date are
 * supplied the window must be ordered (start on or before end). Type and length
 * bounds are enforced at the transport edge; this rule guards the cross-field
 * invariant a single field validator cannot. A violation is a 400 domain
 * validation error. No side effects, no persistence.
 */
export function assertCompetitionContent(content: CompetitionContent): void {
  if (hasInvertedWindow(content)) {
    throw new CompetitionValidationError();
  }
}

function hasInvertedWindow(content: CompetitionContent): boolean {
  if (content.startsOn === null || content.endsOn === null) {
    return false;
  }
  return content.startsOn > content.endsOn;
}
