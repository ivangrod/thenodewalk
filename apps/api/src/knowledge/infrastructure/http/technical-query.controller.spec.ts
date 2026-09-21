import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import type { TechnicalQueryResponse } from '@thenodewalk/contracts';

import { AnswerTechnicalQueryQuery } from '../../application/answer-technical-query.query';
import { TechnicalQueryRequestDto } from './technical-query-request.dto';
import { TechnicalQueryController } from './technical-query.controller';

class StubAnswerTechnicalQueryQuery {
  lastQuery?: string;
  response: TechnicalQueryResponse = { summary: '', graph: { nodes: [], edges: [] } };

  execute(query: string): Promise<TechnicalQueryResponse> {
    this.lastQuery = query;
    return Promise.resolve(this.response);
  }
}

describe('TechnicalQueryController', () => {
  it('delegates the question to the query and returns its response', async () => {
    const stub = new StubAnswerTechnicalQueryQuery();
    stub.response = {
      summary: 'Netflix uses a federated gateway.',
      graph: {
        nodes: [
          {
            id: 'gateway',
            label: 'API Gateway',
            type: 'concept',
            sourceUrl: 'https://netflixtechblog.com/post',
          },
        ],
        edges: [],
      },
    };
    const controller = new TechnicalQueryController(stub as unknown as AnswerTechnicalQueryQuery);
    const body = plainToInstance(TechnicalQueryRequestDto, { query: 'how to scale?' });

    const response = await controller.ask(body);

    expect(stub.lastQuery).toBe('how to scale?');
    expect(response).toBe(stub.response);
  });

  it('accepts a valid body', async () => {
    const body = plainToInstance(TechnicalQueryRequestDto, { query: 'valid question' });

    expect(await validate(body)).toHaveLength(0);
  });

  it('rejects an empty query', async () => {
    const body = plainToInstance(TechnicalQueryRequestDto, { query: '' });

    expect(await validate(body)).not.toHaveLength(0);
  });

  it('rejects a missing query', async () => {
    const body = plainToInstance(TechnicalQueryRequestDto, {});

    expect(await validate(body)).not.toHaveLength(0);
  });
});
