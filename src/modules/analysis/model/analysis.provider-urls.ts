import { VideoProvider } from './analysis.enums';

/**
 * The canonical playback base URL per video provider. The application only ever
 * builds a signed link against these — it never fetches, proxies, or re-hosts
 * the bytes, so an unauthorized viewer can never obtain the recording through
 * the API even if they can reach the API.
 */
export const VIDEO_PROVIDER_BASE_URLS: ReadonlyMap<VideoProvider, string> =
  new Map([
    [VideoProvider.YouTube, 'https://www.youtube.com/watch'],
    [VideoProvider.Vimeo, 'https://player.vimeo.com/video'],
    [VideoProvider.Drive, 'https://drive.google.com/file/d'],
    [VideoProvider.ObjectStorage, 'https://media.ultimate-natives.local/video'],
    [VideoProvider.External, 'https://media.ultimate-natives.local/external'],
  ]);
