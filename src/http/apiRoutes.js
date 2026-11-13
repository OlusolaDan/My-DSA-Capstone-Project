import { DomainError } from '../domain/errors.js';
import { createRouter } from './router.js';
import { createEventService } from '../services/eventService.js';
import { createBookingService } from '../services/bookingService.js';
import { createAuthService } from '../services/authService.js';
import { requireRole, requireUser } from './guards.js';
import { registerAuthRoutes } from '../routes/auth.js';

function queryCriteria(query) {
  const criteria = {};
  for (const key of ['q', 'city', 'from', 'to']) {
    if (query.has(key)) criteria[key] = query.get(key);
  }
  if (query.has('maxPriceCents')) {
    const raw = query.get('maxPriceCents');
    criteria.maxPriceCents = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  }
  if (query.has('onlyAvailable')) {
    const raw = query.get('onlyAvailable');
    if (raw !== 'true' && raw !== 'false') {
      throw new DomainError('VALIDATION', 'onlyAvailable must be true or false');
    }
    criteria.onlyAvailable = raw === 'true';
  }
  return criteria;
}

export function createApiRouter({ repository, paymentGateway, tokenSecret = process.env.AUTH_TOKEN_SECRET }) {
  const router = createRouter();
  const events = createEventService(repository);
  const bookings = createBookingService(repository, paymentGateway);
  const auth = createAuthService(repository, { tokenSecret });
  const userFrom = (request) => requireUser(request, tokenSecret);
  const organizerFrom = (request) => requireRole(userFrom(request), 'organizer');
  const attendeeFrom = (request) => requireRole(userFrom(request), 'attendee');
  registerAuthRoutes(router, { authService: auth, tokenSecret });

  router.post('/api/events', async ({ request, response, body }) => {
    const user = organizerFrom(request);
    const event = await events.create(body, user.sub);
    response.statusCode = 201;
    return event;
  });
  router.post('/api/events/:id/tiers', async ({ request, response, params, body }) => {
    const user = organizerFrom(request);
    const tier = await events.addTier(params.id, body, user.sub);
    response.statusCode = 201;
    return tier;
  });
  router.post('/api/events/:id/publish', ({ request, params }) => {
    const user = organizerFrom(request);
    return events.publish(params.id, user.sub);
  });
  router.get('/api/events', ({ query }) => events.search(queryCriteria(query), query.get('sortBy') ?? 'date'));
  router.get('/api/events/:id', ({ params }) => events.getPublic(params.id));
  router.get('/api/bookings', ({ request }) => {
    const user = attendeeFrom(request);
    return bookings.listForUser(user.sub);
  });
  router.get('/api/bookings/:reference', ({ request, params }) => {
    const user = attendeeFrom(request);
    return bookings.getForUser(params.reference, user.sub);
  });
  router.post('/api/bookings', async ({ request, response, body }) => {
    const user = attendeeFrom(request);
    const booking = await bookings.book(body ?? {}, user.sub);
    response.statusCode = 201;
    return booking;
  });
  router.post('/api/bookings/:reference/pay', ({ request, params, body }) => {
    const user = attendeeFrom(request);
    return bookings.pay(params.reference, user.sub, { decline: body?.decline === true });
  });
  router.post('/api/bookings/:reference/cancel', ({ request, params }) => {
    const user = attendeeFrom(request);
    return bookings.cancel(params.reference, user.sub);
  });
  return router;
}
