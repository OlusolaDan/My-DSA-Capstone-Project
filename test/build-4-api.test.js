import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApplication } from '../src/server.js';

const TOKEN_SECRET = 'build-7-test-secret-0123456789abcdef';

async function start(options = {}) {
  const app = createApplication({ tokenSecret: TOKEN_SECRET, ...options });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  return { app, base: `http://127.0.0.1:${app.address().port}` };
}

async function register(base, email, role) {
  const response = await fetch(`${base}/api/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'valid-pass-123', role }),
  });
  assert.equal(response.status, 201);
  return (await response.json()).token;
}

const json = (method, body, token) => ({
  method,
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
});

test('REST API creates, publishes, searches, books, declines and pays through the real HTTP server', async () => {
  const { app, base } = await start();
  try {
    const organizer = await register(base, 'organizer@example.test', 'organizer');
    const attendee = await register(base, 'attendee@example.test', 'attendee');
    let response = await fetch(`${base}/api/events`, json('POST', { title: 'Lagos Tech Meetup', city: 'Lagos', venue: 'Civic Hall', date: '2026-12-05T17:00:00Z' }, organizer));
    assert.equal(response.status, 201); const event = await response.json();
    response = await fetch(`${base}/api/events/${event.id}/tiers`, json('POST', { name: 'General', priceCents: 2500, capacity: 3 }, organizer));
    assert.equal(response.status, 201); const tier = await response.json();
    response = await fetch(`${base}/api/events/${event.id}/publish`, json('POST', {}, organizer));
    assert.equal((await response.json()).status, 'published');
    response = await fetch(`${base}/api/events?q=TECH&city=lagos&maxPriceCents=3000&sortBy=price`);
    assert.equal((await response.json())[0].id, event.id);
    response = await fetch(`${base}/api/events?onlyAvailable=sometimes`);
    assert.equal(response.status, 400);
    assert.deepEqual((await response.json()).error, {
      code: 'VALIDATION',
      message: 'onlyAvailable must be true or false',
    });
    response = await fetch(`${base}/api/bookings`, json('POST', { tierId: tier.id, quantity: 2 }, attendee));
    assert.equal(response.status, 201); const booking = await response.json(); assert.equal(booking.status, 'pending');
    response = await fetch(`${base}/api/bookings/${booking.reference}/pay`, json('POST', { decline: true }, attendee));
    assert.equal(response.status, 402); assert.deepEqual(await response.json(), { error: { code: 'PAYMENT_DECLINED', message: 'Mock payment was declined' } });
    response = await fetch(`${base}/api/bookings/${booking.reference}/pay`, json('POST', { decline: false }, attendee));
    assert.equal((await response.json()).status, 'paid');
  } finally { app.close(); await once(app, 'close'); }
});

test('API maps domain conflicts to 409 and prevents paying a booking more than once', async () => {
  let charges = 0;
  const { app, base } = await start({
    paymentGateway: {
      async charge() {
        charges += 1;
        return { success: true };
      },
    },
  });
  try {
    const organizer = await register(base, 'organizer@example.test', 'organizer');
    const attendee = await register(base, 'attendee@example.test', 'attendee');
    let response = await fetch(`${base}/api/events`, json('POST', { title: 'Show', city: 'Lagos', venue: 'Hall', date: '2026-12-05' }, organizer));
    const event = await response.json();

    response = await fetch(`${base}/api/events/${event.id}/publish`, json('POST', {}, organizer));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'INVALID_STATE');

    response = await fetch(`${base}/api/events/${event.id}/tiers`, json('POST', { name: 'General', priceCents: 700, capacity: 1 }, organizer));
    const tier = await response.json();
    await fetch(`${base}/api/events/${event.id}/publish`, json('POST', {}, organizer));

    response = await fetch(`${base}/api/bookings`, json('POST', { tierId: tier.id, quantity: 1 }, attendee));
    const cancelledBooking = await response.json();
    response = await fetch(`${base}/api/bookings`, json('POST', { tierId: tier.id, quantity: 1 }, attendee));
    assert.equal(response.status, 409);
    assert.deepEqual((await response.json()).error, {
      code: 'SOLD_OUT',
      message: 'Not enough seats remain',
    });

    response = await fetch(`${base}/api/bookings/${cancelledBooking.reference}/cancel`, json('POST', {}, attendee));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'cancelled');

    response = await fetch(`${base}/api/bookings/${cancelledBooking.reference}/pay`, json('POST', {}, attendee));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'INVALID_TRANSITION');
    assert.equal(charges, 0);

    response = await fetch(`${base}/api/bookings`, json('POST', { tierId: tier.id, quantity: 1 }, attendee));
    const booking = await response.json();
    response = await fetch(`${base}/api/bookings/${booking.reference}/pay`, json('POST', {}, attendee));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'paid');

    response = await fetch(`${base}/api/bookings/${booking.reference}/pay`, json('POST', {}, attendee));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'INVALID_TRANSITION');
    assert.equal(charges, 1);
  } finally { app.close(); await once(app, 'close'); }
});

test('API protects organizer routes and returns NOT_FOUND for another attendee booking', async () => {
  const { app, base } = await start();
  try {
    const organizer = await register(base, 'organizer@example.test', 'organizer');
    const otherOrganizer = await register(base, 'other-organizer@example.test', 'organizer');
    const attendee = await register(base, 'attendee@example.test', 'attendee');
    const otherAttendee = await register(base, 'other-attendee@example.test', 'attendee');
    const createResponse = await fetch(`${base}/api/events`, json('POST', { title: 'Show', city: 'Lagos', venue: 'Hall', date: '2026-12-05' }, organizer));
    const event = await createResponse.json();
    const tierResponse = await fetch(`${base}/api/events/${event.id}/tiers`, json('POST', { name: 'General', priceCents: 700, capacity: 2 }, organizer));
    const tier = await tierResponse.json();
    await fetch(`${base}/api/events/${event.id}/publish`, json('POST', {}, organizer));
    const bookingResponse = await fetch(`${base}/api/bookings`, json('POST', { tierId: tier.id, quantity: 1 }, attendee));
    const booking = await bookingResponse.json();

    const otherRead = await fetch(`${base}/api/bookings/${booking.reference}`, {
      headers: { authorization: `Bearer ${otherAttendee}` },
    });
    assert.equal(otherRead.status, 404);
    assert.equal((await otherRead.json()).error.code, 'NOT_FOUND');
    const otherCancel = await fetch(`${base}/api/bookings/${booking.reference}/cancel`, json('POST', {}, otherAttendee));
    assert.equal(otherCancel.status, 404);
    assert.equal((await otherCancel.json()).error.code, 'NOT_FOUND');

    const wrongOwner = await fetch(`${base}/api/events/${event.id}/publish`, json('POST', {}, otherOrganizer));
    assert.equal(wrongOwner.status, 403);
    assert.equal((await wrongOwner.json()).error.code, 'FORBIDDEN');
    const attendeeCreate = await fetch(`${base}/api/events`, json('POST', { title: 'No', city: 'Lagos', venue: 'Hall', date: '2026-12-05' }, attendee));
    assert.equal(attendeeCreate.status, 403);
  } finally { app.close(); await once(app, 'close'); }
});
