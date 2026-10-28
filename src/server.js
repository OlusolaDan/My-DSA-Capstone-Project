import { createApp } from './http/app.js';
import { config } from './config.js';

const app = createApp();
app.listen(config.port, () => {
  console.log(`Event ticketing server listening on port ${config.port}`);
});
