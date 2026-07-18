import { describe, expect, it } from 'vitest';

import { AVATAR_MAX_BYTES } from '../model/members.constants';
import type { RequestAvatarCommand } from '../model/members.types';
import {
  isAllowedContentType,
  isValidAvatarUpload,
  isValidDimension,
  isWithinSizeLimit,
} from './media-validation.policy';

const VALID: RequestAvatarCommand = {
  contentType: 'image/png',
  byteSize: 1024,
  width: 256,
  height: 256,
};

describe('media-validation.policy', () => {
  describe('isAllowedContentType', () => {
    it('accepts allow-listed image types', () => {
      expect(isAllowedContentType('image/jpeg')).toBe(true);
      expect(isAllowedContentType('image/webp')).toBe(true);
    });

    it('rejects other types', () => {
      expect(isAllowedContentType('application/pdf')).toBe(false);
      expect(isAllowedContentType('image/svg+xml')).toBe(false);
    });
  });

  describe('isWithinSizeLimit', () => {
    it('accepts a positive size within the ceiling', () => {
      expect(isWithinSizeLimit(1)).toBe(true);
      expect(isWithinSizeLimit(AVATAR_MAX_BYTES)).toBe(true);
    });

    it('rejects zero, negative, non-integer, and oversize', () => {
      expect(isWithinSizeLimit(0)).toBe(false);
      expect(isWithinSizeLimit(-1)).toBe(false);
      expect(isWithinSizeLimit(10.5)).toBe(false);
      expect(isWithinSizeLimit(AVATAR_MAX_BYTES + 1)).toBe(false);
    });
  });

  describe('isValidDimension', () => {
    it('accepts null (unknown dimension, null-not-zero)', () => {
      expect(isValidDimension(null)).toBe(true);
    });

    it('accepts an in-range integer', () => {
      expect(isValidDimension(256)).toBe(true);
    });

    it('rejects out-of-range or non-integer values', () => {
      expect(isValidDimension(16)).toBe(false);
      expect(isValidDimension(10000)).toBe(false);
      expect(isValidDimension(100.5)).toBe(false);
    });
  });

  describe('isValidAvatarUpload', () => {
    it('accepts a fully valid upload', () => {
      expect(isValidAvatarUpload(VALID)).toBe(true);
    });

    it('accepts an upload with unknown dimensions', () => {
      expect(isValidAvatarUpload({ ...VALID, width: null, height: null })).toBe(
        true,
      );
    });

    it('rejects a bad content type', () => {
      expect(isValidAvatarUpload({ ...VALID, contentType: 'text/plain' })).toBe(
        false,
      );
    });

    it('rejects an oversize upload', () => {
      expect(
        isValidAvatarUpload({ ...VALID, byteSize: AVATAR_MAX_BYTES + 1 }),
      ).toBe(false);
    });

    it('rejects a bad dimension', () => {
      expect(isValidAvatarUpload({ ...VALID, height: 1 })).toBe(false);
    });
  });
});
