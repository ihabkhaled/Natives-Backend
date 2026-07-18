import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  OPAQUE_TOKEN_ENCODING,
  SECURE_TOKEN_BYTE_LENGTH,
} from '../model/identity.constants';
import type { SecureRandomPort } from '../model/identity.types';

/**
 * Cryptographically secure opaque-token generator backed by node:crypto. The
 * only source of token entropy in the module; injected behind SecureRandomPort
 * so use cases stay deterministic under test.
 */
@Injectable()
export class CryptoSecureRandomAdapter implements SecureRandomPort {
  generateToken(): string {
    return randomBytes(SECURE_TOKEN_BYTE_LENGTH).toString(
      OPAQUE_TOKEN_ENCODING,
    );
  }
}
