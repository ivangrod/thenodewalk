import type { VercelRequest, VercelResponse } from '@vercel/node';

import { createApp } from '../src/server';

let applicationPromise: ReturnType<typeof createApp> | undefined;

export default async function handler(request: VercelRequest, response: VercelResponse) {
  applicationPromise ??= createApp();
  const application = await applicationPromise;

  return application.getHttpAdapter().getInstance()(request, response);
}
