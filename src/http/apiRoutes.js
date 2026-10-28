import { createRouter } from './router.js';
import { createEventService } from '../services/eventService.js';
import { createBookingService } from '../services/bookingService.js';

function queryCriteria(query) {
  const criteria = {};
  for (const key of ['q', 'city', 'from', 'to']) {
    if (query.has(key)) criteria[key] = query.get(key);
  }
  if (query.has('maxPriceCents')) {
    const raw = query.get('maxPriceCents');
    criteria.maxPriceCents = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  }
  if (query.has('onlyAvailable')) criteria.onlyAvailable = query.get('onlyAvailable') === 'true';
  return criteria;
}

export function createApiRouter({ repository, paymentGateway }) {
  const router = createRouter();
  const events = createEventService(repository);
  const bookings = createBookingService(repository, paymentGateway);
  router.post('/api/events', async ({ request, response, body }) => {
    const event = await events.create(body, request.headers['x-user-id']);
    response.statusCode = 201;
    return event;
  });
  router.post('/api/events/:id/tiers', async ({ request, response, params, body }) => {
    const tier = await events.addTier(params.id, body, request.headers['x-user-id']);
    response.statusCode = 201;
    return tier;
  });
  router.post('/api/events/:id/publish', ({ request, params }) => events.publish(params.id, request.headers['x-user-id']));
  router.get('/api/events', ({ query }) => events.search(queryCriteria(query), query.get('sortBy') ?? 'date'));
  router.post('/api/bookings', async ({ request, response, body }) => {
    const booking = await bookings.book(body ?? {}, request.headers['x-user-id']);
    response.statusCode = 201;
    return booking;
  });
  router.post('/api/bookings/:reference/pay', ({ request, params, body }) => bookings.pay(params.reference, request.headers['x-user-id'], { decline: body?.decline === true }));
  router.post('/api/bookings/:reference/cancel', ({ request, params }) => bookings.cancel(params.reference, request.headers['x-user-id']));
  return router;
}
