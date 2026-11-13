import { createApp } from './http/app.js';
import { createApiRouter } from './http/apiRoutes.js';
import { createMemoryRepository } from './repositories/memory.js';
import { createSqliteRepository } from './repositories/sqlite.js';
import { createMockPaymentGateway } from './lib/mockPaymentGateway.js';
import { config } from './config.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function createApplication({ repository = createMemoryRepository(), paymentGateway = createMockPaymentGateway(), publicDir, tokenSecret = process.env.AUTH_TOKEN_SECRET } = {}) {
  const router = createApiRouter({ repository, paymentGateway, tokenSecret });
  return createApp({ router, ...(publicDir ? { publicDir } : {}) });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (typeof config.authTokenSecret !== 'string' || Buffer.byteLength(config.authTokenSecret) < 32) {
    throw new Error('Set AUTH_TOKEN_SECRET to a secret of at least 32 bytes before starting the server');
  }
  const app = createApplication({ repository: createSqliteRepository() });
  app.listen(config.port, () => console.log(`Event ticketing server listening on port ${config.port}`));
}
