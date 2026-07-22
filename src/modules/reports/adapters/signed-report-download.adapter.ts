import { createHmac } from 'node:crypto';

import { AppConfigService } from '@config/app-config.service';
import { Injectable } from '@nestjs/common';

import {
  DOWNLOAD_BASE_URL,
  DOWNLOAD_METHOD,
  DOWNLOAD_TTL_SECONDS,
  MILLISECONDS_PER_SECOND,
  SIGNATURE_ALGORITHM,
} from '../model/reports.constants';
import type {
  DownloadRequest,
  DownloadTicket,
  ReportDownloadPort,
} from '../model/reports.types';

/**
 * Signed report-download adapter (UN-701). Stands in for a real object-storage
 * provider behind the app-owned `ReportDownloadPort`: it never streams the
 * artifact through the application, only mints a short-lived HMAC-signed URL
 * bound to the storage reference and the artifact CHECKSUM. The signing secret
 * is the configured app secret. Swapping in a cloud SDK touches only this file.
 */
@Injectable()
export class SignedReportDownloadAdapter implements ReportDownloadPort {
  constructor(private readonly config: AppConfigService) {}

  createDownloadTicket(request: DownloadRequest): DownloadTicket {
    const expiresAt = new Date(
      request.now.getTime() + DOWNLOAD_TTL_SECONDS * MILLISECONDS_PER_SECOND,
    );
    const expiryEpoch = Math.floor(
      expiresAt.getTime() / MILLISECONDS_PER_SECOND,
    );
    const signature = this.sign(request, expiryEpoch);
    const reference = encodeURIComponent(request.storageReference);
    return {
      url: `${DOWNLOAD_BASE_URL}/${reference}?method=${DOWNLOAD_METHOD}&expires=${expiryEpoch}&checksum=${request.checksum}&signature=${signature}`,
      expiresAt,
      checksum: request.checksum,
    };
  }

  private sign(request: DownloadRequest, expiryEpoch: number): string {
    return createHmac(SIGNATURE_ALGORITHM, this.config.security.jwtSecret)
      .update(
        `${DOWNLOAD_METHOD}:${request.storageReference}:${request.checksum}:${expiryEpoch}`,
      )
      .digest('hex');
  }
}
