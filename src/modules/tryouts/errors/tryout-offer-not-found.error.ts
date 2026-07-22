import { NotFoundError } from '@core/errors/not-found.error';

import {
  TRYOUT_OFFER_NOT_FOUND_MESSAGE,
  TRYOUT_OFFER_NOT_FOUND_MESSAGE_KEY,
} from '../model/tryouts.constants';

export class TryoutOfferNotFoundError extends NotFoundError {
  constructor() {
    super(TRYOUT_OFFER_NOT_FOUND_MESSAGE, TRYOUT_OFFER_NOT_FOUND_MESSAGE_KEY);
  }
}
