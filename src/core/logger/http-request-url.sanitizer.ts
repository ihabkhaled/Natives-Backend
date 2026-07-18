import {
  HTTP_URL_SEGMENT_END_PATTERN,
  REDACT_CENSOR,
  SENSITIVE_HTTP_URL_SEGMENTS,
} from './logger.constants';

/** Replace path-borne bearer credentials before a request URL reaches pino. */
export function sanitizeHttpRequestUrl(url: string): string {
  for (const pattern of SENSITIVE_HTTP_URL_SEGMENTS) {
    const markerIndex = url.indexOf(pattern.routeMarker);
    if (markerIndex < 0) {
      continue;
    }

    const tokenStart = markerIndex + pattern.routeMarker.length;
    const relativeSegmentEnd = url
      .slice(tokenStart)
      .search(HTTP_URL_SEGMENT_END_PATTERN);
    const segmentEnd =
      relativeSegmentEnd < 0 ? url.length : tokenStart + relativeSegmentEnd;
    const segment = url.slice(tokenStart, segmentEnd);
    const preservedSuffix =
      'preservedSuffix' in pattern && segment.endsWith(pattern.preservedSuffix)
        ? pattern.preservedSuffix
        : '';
    const tokenEnd = segmentEnd - preservedSuffix.length;
    if (tokenStart === tokenEnd) {
      return url;
    }

    return `${url.slice(0, tokenStart)}${REDACT_CENSOR}${url.slice(tokenEnd)}`;
  }

  return url;
}
