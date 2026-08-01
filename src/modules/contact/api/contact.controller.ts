import { Public } from '@core/auth';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@core/openapi';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { SendContactUseCase } from '../application/send-contact.use-case';
import { CONTACT_API_TAG, CONTACT_ROUTE } from '../model/contact.constants';
import { ContactRequestDto } from './dto/contact-request.dto';
import { ContactResponseDto } from './dto/contact-response.dto';

/**
 * Public contact form. Stateless: the submission is relayed to the operator
 * inbox by email and nothing is persisted. Rate-limited by the global throttler
 * (RATE_LIMIT_MAX) and, on delivery, by the email send throttle
 * (RATE_LIMIT_MAX/RATE_LIMIT_WINDOW_MS).
 */
@ApiTags(CONTACT_API_TAG)
@Controller(CONTACT_ROUTE)
export class ContactController {
  constructor(private readonly sendContact: SendContactUseCase) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message to the team via the contact form' })
  @ApiCreatedResponse({
    description: 'Message accepted and handed to the email transport',
    type: ContactResponseDto,
  })
  send(@Body() dto: ContactRequestDto): Promise<ContactResponseDto> {
    return this.sendContact.execute({
      email: dto.email,
      subject: dto.subject,
      message: dto.message,
    });
  }
}
