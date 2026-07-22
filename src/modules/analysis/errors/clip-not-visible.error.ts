import { ForbiddenError } from '@core/errors/forbidden.error';

import {
  CLIP_NOT_VISIBLE_MESSAGE,
  CLIP_NOT_VISIBLE_MESSAGE_KEY,
} from '../model/analysis.constants';

export class ClipNotVisibleError extends ForbiddenError {
  constructor() {
    super(CLIP_NOT_VISIBLE_MESSAGE, CLIP_NOT_VISIBLE_MESSAGE_KEY);
  }
}
