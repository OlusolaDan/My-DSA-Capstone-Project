import { createApp } from './http/app.js';
import { createApiRouter } from './http/apiRoutes.js';
import { createMemoryRepository } from './repositories/memory.js';
import { createMockPaymentGateway } from './lib/mockPaymentGateway.js';
import { config } from './config.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function createApplication({ repository = createMemoryRepository(), paymentGateway = createMockPaymentGateway(), publicDir } = {}) {
  const router = createApiRouter({ repository, paymentGateway });
  return createApp({ router, ...(publicDir ? { publicDir } : {}) });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createApplication();
  app.listen(config.port, () => console.log(`Event ticketing server listening on port ${config.port}`));
}
