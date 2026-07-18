import { createHmac } from 'node:crypto';

import { AppConfigService } from '@config/app-config.service';
import { Injectable } from '@nestjs/common';

import {
  MEDIA_DOWNLOAD_METHOD,
  MEDIA_DOWNLOAD_URL_TTL_SECONDS,
  MEDIA_SIGNATURE_ALGORITHM,
  MEDIA_STORAGE_BASE_URL,
  MEDIA_UPLOAD_METHOD,
  MEDIA_UPLOAD_URL_TTL_SECONDS,
  MILLISECONDS_PER_SECOND,
} from '../model/members.constants';
import type {
  MediaStoragePort,
  SignedDownloadRequest,
  SignedUrl,
  SignedUrlRequest,
} from '../model/members.types';

/**
 * Signed-URL object-storage adapter. Stands in for a real bucket provider
 * (S3/GCS) behind the app-owned MediaStoragePort: it never moves bytes through
 * the application, only mints short-lived HMAC-signed URLs scoped to a single
 * storage key and HTTP method. The signing secret is the configured app secret,
 * read through the typed config service. Replacing this with a cloud SDK touches
 * only this file.
 */
@Injectable()
export class SignedUrlMediaStorageAdapter implements MediaStoragePort {
  constructor(private readonly config: AppConfigService) {}

  createUploadUrl(request: SignedUrlRequest): SignedUrl {
    return this.sign(
      MEDIA_UPLOAD_METHOD,
      request.storageKey,
      request.now,
      MEDIA_UPLOAD_URL_TTL_SECONDS,
    );
  }

  createDownloadUrl(request: SignedDownloadRequest): SignedUrl {
    return this.sign(
      MEDIA_DOWNLOAD_METHOD,
      request.storageKey,
      request.now,
      MEDIA_DOWNLOAD_URL_TTL_SECONDS,
    );
  }

  private sign(
    method: string,
    storageKey: string,
    now: Date,
    ttlSeconds: number,
  ): SignedUrl {
    const expiresAt = new Date(
      now.getTime() + ttlSeconds * MILLISECONDS_PER_SECOND,
    );
    const expiryEpoch = Math.floor(
      expiresAt.getTime() / MILLISECONDS_PER_SECOND,
    );
    const signature = createHmac(
      MEDIA_SIGNATURE_ALGORITHM,
      this.config.security.jwtSecret,
    )
      .update(`${method}:${storageKey}:${expiryEpoch}`)
      .digest('hex');
    const url = `${MEDIA_STORAGE_BASE_URL}/${storageKey}?method=${method}&expires=${expiryEpoch}&signature=${signature}`;
    return { url, expiresAt };
  }
}
