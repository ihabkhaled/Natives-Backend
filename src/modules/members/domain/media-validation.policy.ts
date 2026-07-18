import {
  AVATAR_ALLOWED_CONTENT_TYPES,
  AVATAR_MAX_BYTES,
  AVATAR_MAX_DIMENSION,
  AVATAR_MIN_DIMENSION,
} from '../model/members.constants';
import type { RequestAvatarCommand } from '../model/members.types';

/**
 * Pure avatar media validation: content type allow-list, byte-size ceiling, and
 * pixel-dimension bounds. Dimensions are optional (a client may not know them
 * before upload); when present they are bounded, when absent (null) they are not
 * fabricated — null-not-zero. Content bytes are never inspected here; the malware
 * scan is a separate, asynchronous state on the persisted asset.
 */

export function isAllowedContentType(contentType: string): boolean {
  return AVATAR_ALLOWED_CONTENT_TYPES.includes(contentType);
}

export function isWithinSizeLimit(byteSize: number): boolean {
  return (
    Number.isInteger(byteSize) && byteSize > 0 && byteSize <= AVATAR_MAX_BYTES
  );
}

export function isValidDimension(value: number | null): boolean {
  if (value === null) {
    return true;
  }
  return (
    Number.isInteger(value) &&
    value >= AVATAR_MIN_DIMENSION &&
    value <= AVATAR_MAX_DIMENSION
  );
}

/** True only when content type, size, and both dimensions all satisfy the rules. */
export function isValidAvatarUpload(command: RequestAvatarCommand): boolean {
  return (
    isAllowedContentType(command.contentType) &&
    isWithinSizeLimit(command.byteSize) &&
    isValidDimension(command.width) &&
    isValidDimension(command.height)
  );
}
