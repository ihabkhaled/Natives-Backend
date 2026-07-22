import { createHmac } from 'node:crypto';

import { AppConfigService } from '@config/app-config.service';
import { Injectable } from '@nestjs/common';

import {
  MILLISECONDS_PER_SECOND,
  VIDEO_ACCESS_ALGORITHM,
  VIDEO_ACCESS_METHOD,
  VIDEO_ACCESS_TTL_SECONDS,
} from '../model/analysis.constants';
import { VIDEO_PROVIDER_BASE_URLS } from '../model/analysis.provider-urls';
import type {
  VideoAccessPort,
  VideoAccessRequest,
  VideoAccessTicket,
} from '../model/analysis.types';

/**
 * Signed provider-access adapter. Stands in for a real video provider SDK behind
 * the app-owned `VideoAccessPort`: it never proxies or re-hosts the recording,
 * it only mints a short-lived HMAC-signed provider URL scoped to one object
 * reference and the GET method. The signing secret is the configured app secret,
 * read through the typed config service. Swapping in a real provider SDK touches
 * only this file.
 */
@Injectable()
export class SignedVideoAccessAdapter implements VideoAccessPort {
  constructor(private readonly config: AppConfigService) {}

  createAccessTicket(request: VideoAccessRequest): VideoAccessTicket {
    const expiresAt = new Date(
      request.now.getTime() +
        VIDEO_ACCESS_TTL_SECONDS * MILLISECONDS_PER_SECOND,
    );
    const expiryEpoch = Math.floor(
      expiresAt.getTime() / MILLISECONDS_PER_SECOND,
    );
    return {
      url: this.buildUrl(request, expiryEpoch),
      expiresAt,
    };
  }

  private buildUrl(request: VideoAccessRequest, expiryEpoch: number): string {
    const base = VIDEO_PROVIDER_BASE_URLS.get(request.provider) ?? '';
    const reference = encodeURIComponent(request.externalRef);
    const signature = this.sign(request, expiryEpoch);
    return `${base}/${reference}?method=${VIDEO_ACCESS_METHOD}&expires=${expiryEpoch}&signature=${signature}`;
  }

  private sign(request: VideoAccessRequest, expiryEpoch: number): string {
    return createHmac(VIDEO_ACCESS_ALGORITHM, this.config.security.jwtSecret)
      .update(
        `${VIDEO_ACCESS_METHOD}:${request.provider}:${request.externalRef}:${expiryEpoch}`,
      )
      .digest('hex');
  }
}
