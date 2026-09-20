import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import type { TechnicalQueryResponse } from '@thenodewalk/contracts';

import { AnswerTechnicalQueryQuery } from '../../application/answer-technical-query.query';
import { TechnicalQueryRequestDto } from './technical-query-request.dto';

@ApiTags('technical-queries')
@Controller('technical-queries')
export class TechnicalQueryController {
  constructor(private readonly answerTechnicalQuery: AnswerTechnicalQueryQuery) {}

  @Post()
  @ApiOkResponse({ description: 'The most relevant indexed chunks for the question.' })
  ask(@Body() body: TechnicalQueryRequestDto): Promise<TechnicalQueryResponse> {
    return this.answerTechnicalQuery.execute(body.query);
  }
}
