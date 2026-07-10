import { NodeEnv } from '@shared/enums';

import {
  HTTP_PROTOCOL,
  HTTPS_PROTOCOL,
  JWT_SECRET_FORBIDDEN_FRAGMENTS,
  JWT_SECRET_FORBIDDEN_SEQUENCES,
  JWT_SECRET_MIN_LENGTH,
  JWT_SECRET_MIN_UNIQUE_CHARACTERS,
  JWT_SECRET_PRODUCTION_PATTERN,
} from './config.constants';
import { parseCsv } from './config.utils';

function isHttpOrigin(origin: string): boolean {
  if (!URL.canParse(origin)) {
    return false;
  }
  const url = new URL(origin);
  const isHttpProtocol =
    url.protocol === HTTP_PROTOCOL || url.protocol === HTTPS_PROTOCOL;
  return isHttpProtocol && url.origin === origin;
}

export function areCorsOriginsValid(value: string | undefined): boolean {
  return parseCsv(value).every(origin => isHttpOrigin(origin));
}

export function isProductionJwtSecretValid(
  nodeEnv: NodeEnv,
  secret: string | undefined,
): boolean {
  if (nodeEnv !== NodeEnv.Production) {
    return true;
  }
  if (secret === undefined || secret.length < JWT_SECRET_MIN_LENGTH) {
    return false;
  }

  const normalizedSecret = secret.toLowerCase();
  const hasForbiddenFragment = JWT_SECRET_FORBIDDEN_FRAGMENTS.some(fragment =>
    normalizedSecret.includes(fragment),
  );
  const hasSequentialPattern = JWT_SECRET_FORBIDDEN_SEQUENCES.some(sequence =>
    normalizedSecret.includes(sequence),
  );
  const uniqueCharacterCount = new Set(secret).size;
  return (
    !hasForbiddenFragment &&
    !hasSequentialPattern &&
    JWT_SECRET_PRODUCTION_PATTERN.test(secret) &&
    uniqueCharacterCount >= JWT_SECRET_MIN_UNIQUE_CHARACTERS
  );
}
