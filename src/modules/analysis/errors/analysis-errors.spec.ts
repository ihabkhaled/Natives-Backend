import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AnalysisScopeNotFoundError } from './analysis-scope-not-found.error';
import { AnalysisValidationError } from './analysis-validation.error';
import { ClipImmutableError } from './clip-immutable.error';
import { ClipInvalidTransitionError } from './clip-invalid-transition.error';
import { ClipNotVisibleError } from './clip-not-visible.error';
import { ClipTimestampError } from './clip-timestamp.error';
import { ClipVersionConflictError } from './clip-version-conflict.error';
import { VideoAccessDeniedError } from './video-access-denied.error';
import { VideoClipNotFoundError } from './video-clip-not-found.error';
import { VideoSourceNotFoundError } from './video-source-not-found.error';

describe('analysis errors', () => {
  it('maps each error to its status and stable messageKey', () => {
    const cases = [
      {
        error: new VideoSourceNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.analysis.videoSourceNotFound',
      },
      {
        error: new VideoClipNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.analysis.videoClipNotFound',
      },
      {
        error: new AnalysisScopeNotFoundError(),
        status: HttpStatus.NOT_FOUND,
        key: 'errors.analysis.scopeNotFound',
      },
      {
        error: new ClipTimestampError(),
        status: HttpStatus.BAD_REQUEST,
        key: 'errors.analysis.clipTimestamp',
      },
      {
        error: new AnalysisValidationError(),
        status: HttpStatus.BAD_REQUEST,
        key: 'errors.analysis.validation',
      },
      {
        error: new ClipInvalidTransitionError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.analysis.clipInvalidTransition',
      },
      {
        error: new ClipVersionConflictError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.analysis.clipVersionConflict',
      },
      {
        error: new ClipImmutableError(),
        status: HttpStatus.CONFLICT,
        key: 'errors.analysis.clipImmutable',
      },
      {
        error: new VideoAccessDeniedError(),
        status: HttpStatus.FORBIDDEN,
        key: 'errors.analysis.videoAccessDenied',
      },
      {
        error: new ClipNotVisibleError(),
        status: HttpStatus.FORBIDDEN,
        key: 'errors.analysis.clipNotVisible',
      },
    ];
    for (const { error, status, key } of cases) {
      expect(error.status).toBe(status);
      expect(error.messageKey).toBe(key);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });

  it('never leaks SQL, vendor text, or personal data in a message', () => {
    const messages = [
      new VideoSourceNotFoundError().message,
      new ClipNotVisibleError().message,
      new VideoAccessDeniedError().message,
      new ClipImmutableError().message,
    ];
    for (const message of messages) {
      expect(message).not.toMatch(/SELECT|INSERT|UPDATE|pg_|@/u);
    }
  });
});
