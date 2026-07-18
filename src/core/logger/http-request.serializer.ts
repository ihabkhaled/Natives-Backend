import type { SerializedRequest } from 'pino-std-serializers';

import { sanitizeHttpRequestUrl } from './http-request-url.sanitizer';

/** Preserve the standard request projection while sanitizing sensitive URLs. */
export function serializeHttpRequest(
  request: SerializedRequest,
): Record<string, unknown> {
  return {
    ...request,
    url: sanitizeHttpRequestUrl(request.url),
  };
}
