import { registerAs } from '@nestjs/config';
import { NodeEnv } from '@shared/enums';

import {
  DEFAULT_JOBS_ENABLED,
  JOBS_CONFIG_NAMESPACE,
  NODE_ENV_CONFIG_NAME,
} from './config.constants';
import type { JobsConfig } from './config.types';
import { parseBoolean, parseNodeEnv, requireConfigValue } from './config.utils';

/**
 * Typed scheduled-jobs configuration. `JOBS_ENABLED` gates the interval
 * scheduler (default on); under NODE_ENV=test it is FORCED off regardless of
 * the flag, so no suite ever races a background dispatcher against its own
 * fixtures. The only place the jobs env var is read.
 */
export const jobsConfig = registerAs(JOBS_CONFIG_NAMESPACE, (): JobsConfig => {
  const nodeEnv = parseNodeEnv(
    requireConfigValue(process.env['NODE_ENV'], NODE_ENV_CONFIG_NAME),
  );
  return {
    enabled:
      nodeEnv !== NodeEnv.Test &&
      parseBoolean(process.env['JOBS_ENABLED'], DEFAULT_JOBS_ENABLED),
  };
});
