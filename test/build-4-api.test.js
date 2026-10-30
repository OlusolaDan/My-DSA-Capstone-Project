import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApplication } from '../src/server.js';

async function start(options = {}) {
  const app = createApplication(options);
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  return { app, base: `http://127.0.0.1:${app.address().port}` };
}
const json = (method, body) => ({ method, headers: { 'content-type': 'application/json', 'x-user-id': 'attendee-1' }, body: JSON.stringify(body) });

test('REST API creates, publishes, searches, books, declines and pays through the real HTTP server', async () => {
  const { app, base } = await start();
  try {
    const organizer = { 'content-type': 'application/json', 'x-user-id': 'organizer-1' };
    let response = await fetch(`${base}/api/events`, { method: 'POST', headers: organizer, body: JSON.stringify({ title: 'Lagos Tech Meetup', city: 'Lagos', venue: 'Civic Hall', date: '2026-12-05T17:00:00Z' }) });
    assert.equal(response.status, 201); const event = await response.json();
    response = await fetch(`${base}/api/events/${event.id}/tiers`, { method: 'POST', headers: organizer, body: JSON.stringify({ name: 'General', priceCents: 2500, capacity: 3 }) });
    assert.equal(response.status, 201); const tier = await response.json();
    response = await fetch(`${base}/api/events/${event.id}/publish`, { method: 'POST', headers: { 'x-user-id': 'organizer-1' } });
    assert.equal((await response.json()).status, 'published');
    response = await fetch(`${base}/api/events?q=TECH&city=lagos&maxPriceCents=3000&sortBy=price`);
    assert.equal((await response.json())[0].id, event.id);
    response = await fetch(`${base}/api/events?onlyAvailable=sometimes`);
    assert.equal(response.status, 400);
    assert.deepEqual((await response.json()).error, {
      code: 'VALIDATION',
      message: 'onlyAvailable must be true or false',
    });
    response = await fetch(`${base}/api/bookings`, json('POST', { tierId: tier.id, quantity: 2 }));
    assert.equal(response.status, 201); let booking = await response.json(); assert.equal(booking.status, 'pending');
    response = await fetch(`${base}/api/bookings/${booking.reference}/pay`, json('POST', { decline: true }));
    assert.equal(response.status, 402); assert.deepEqual(await response.json(), { error: { code: 'PAYMENT_DECLINED', message: 'Mock payment was declined' } });
    response = await fetch(`${base}/api/bookings/${booking.reference}/pay`, json('POST', { decline: false }));
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
    const organizer = { 'content-type': 'application/json', 'x-user-id': 'organizer' };
    let response = await fetch(`${base}/api/events`, {
      method: 'POST',
      headers: organizer,
      body: JSON.stringify({ title: 'Show', city: 'Lagos', venue: 'Hall', date: '2026-12-05' }),
    });
    const event = await response.json();

    response = await fetch(`${base}/api/events/${event.id}/publish`, {
      method: 'POST',
      headers: { 'x-user-id': 'organizer' },
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'INVALID_STATE');

    response = await fetch(`${base}/api/events/${event.id}/tiers`, {
      method: 'POST',
      headers: organizer,
      body: JSON.stringify({ name: 'General', priceCents: 700, capacity: 1 }),
    });
    const tier = await response.json();
    await fetch(`${base}/api/events/${event.id}/publish`, {
      method: 'POST',
      headers: { 'x-user-id': 'organizer' },
    });

    response = await fetch(`${base}/api/bookings`, json('POST', { tierId: tier.id, quantity: 1 }));
    const cancelledBooking = await response.json();
    response = await fetch(`${base}/api/bookings`, json('POST', { tierId: tier.id, quantity: 1 }));
    assert.equal(response.status, 409);
    assert.deepEqual((await response.json()).error, {
      code: 'SOLD_OUT',
      message: 'Not enough seats remain',
    });

    response = await fetch(`${base}/api/bookings/${cancelledBooking.reference}/cancel`, {
      method: 'POST',
      headers: { 'x-user-id': 'attendee-1' },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'cancelled');

    response = await fetch(`${base}/api/bookings/${cancelledBooking.reference}/pay`, json('POST', {}));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'INVALID_TRANSITION');
    assert.equal(charges, 0);

    response = await fetch(`${base}/api/bookings`, json('POST', { tierId: tier.id, quantity: 1 }));
    const booking = await response.json();
    response = await fetch(`${base}/api/bookings/${booking.reference}/pay`, json('POST', {}));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'paid');

    response = await fetch(`${base}/api/bookings/${booking.reference}/pay`, json('POST', {}));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'INVALID_TRANSITION');
    assert.equal(charges, 1);
  } finally { app.close(); await once(app, 'close'); }
});

test('API enforces booking ownership and unpaid-only cancellation with a shared error shape', async () => {
  const { app, base } = await start();
  try {
    const organizer = { 'content-type': 'application/json', 'x-user-id': 'organizer' };
    const createResponse = await fetch(`${base}/api/events`, { method: 'POST', headers: organizer, body: JSON.stringify({ title: 'Show', city: 'Lagos', venue: 'Hall', date: '2026-12-05' }) });
    const event = await createResponse.json();
    const tierResponse = await fetch(`${base}/api/events/${event.id}/tiers`, { method: 'POST', headers: organizer, body: JSON.stringify({ name: 'General', priceCents: 700, capacity: 1 }) });
    const tier = await tierResponse.json();
    await fetch(`${base}/api/events/${event.id}/publish`, { method: 'POST', headers: { 'x-user-id': 'organizer' } });
    const bookingResponse = await fetch(`${base}/api/bookings`, json('POST', { tierId: tier.id, quantity: 1 }));
    const booking = await bookingResponse.json();
    const forbidden = await fetch(`${base}/api/bookings/${booking.reference}/pay`, { ...json('POST', {}), headers: { 'content-type': 'application/json', 'x-user-id': 'intruder' } });
    assert.equal(forbidden.status, 403); assert.equal((await forbidden.json()).error.code, 'FORBIDDEN');
    const paid = await fetch(`${base}/api/bookings/${booking.reference}/pay`, json('POST', {})); await paid.json();
    const cancelPaid = await fetch(`${base}/api/bookings/${booking.reference}/cancel`, { method: 'POST', headers: { 'x-user-id': 'attendee-1' } });
    assert.equal(cancelPaid.status, 409); assert.equal((await cancelPaid.json()).error.code, 'INVALID_TRANSITION');
  } finally { app.close(); await once(app, 'close'); }
});
