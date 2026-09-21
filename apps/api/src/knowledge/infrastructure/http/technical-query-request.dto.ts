import { IsNotEmpty, IsString } from 'class-validator';

import type { TechnicalQueryRequest } from '@thenodewalk/contracts';

/**
 * Request body for `POST /technical-queries`. Validated with class-validator via
 * the global {@link ValidationPipe}.
 */
export class TechnicalQueryRequestDto implements TechnicalQueryRequest {
  @IsString()
  @IsNotEmpty()
  query!: string;
}
