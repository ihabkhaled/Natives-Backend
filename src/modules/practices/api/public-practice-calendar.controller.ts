import { Public } from '@core/auth';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@core/openapi';
import { Controller, Get, Header, Param } from '@nestjs/common';

import { CalendarFeedService } from '../application/calendar-feed.service';
import {
  FEED_TOKEN_PARAM,
  PUBLIC_CALENDAR_FEED_ROUTE,
} from '../model/calendar.constants';
import { PRACTICES_API_TAG } from '../model/practices.constants';

@ApiTags(PRACTICES_API_TAG)
@Controller()
export class PublicPracticeCalendarController {
  constructor(private readonly feeds: CalendarFeedService) {}

  @Public()
  @Get(PUBLIC_CALENDAR_FEED_ROUTE)
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'inline; filename="practices.ics"')
  @ApiOperation({ summary: 'Render a scoped practice calendar subscription' })
  @ApiOkResponse({
    description: 'RFC 5545 calendar',
    schema: { type: 'string' },
  })
  @ApiNotFoundResponse({ description: 'Calendar feed unavailable' })
  render(@Param(FEED_TOKEN_PARAM) token: string): Promise<string> {
    return this.feeds.render(token);
  }
}
