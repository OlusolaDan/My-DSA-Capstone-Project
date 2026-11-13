import test from 'node:test';
import assert from 'node:assert/strict';
import { createBooking, getEvent, listEvents, MockApiError, pay } from '../public/js/api.js';
import { events } from '../public/js/mockData.js';
import { formatPrice } from '../public/js/ui.js';

test('mock event listing searches, filters by city and price, and sorts without mutating data', async () => {
  const before = events.map((event) => ({
    id: event.id,
    tiers: event.tiers.map((tier) => ({ id: tier.id, seatsLeft: tier.seatsLeft, sold: tier.sold })),
  }));
  const found = await listEvents({ q: 'jazz', city: 'abuja', maxPriceCents: 500000, sortBy: 'price' });
  assert.deepEqual(found.map((event) => event.id), ['abuja-jazz-night']);
  assert.deepEqual(events.map((event) => ({
    id: event.id,
    tiers: event.tiers.map((tier) => ({ id: tier.id, seatsLeft: tier.seatsLeft, sold: tier.sold })),
  })), before);
  assert.notEqual(found[0], events[1]);
  await assert.rejects(listEvents({ from: '2026-02-30' }), { code: 'VALIDATION' });
});

test('event details return their ticket tiers and unknown events use the API error shape', async () => {
  const event = await getEvent('lagos-tech-summit');
  assert.equal(event.tiers[0].priceCents, 250000);
  await assert.rejects(getEvent('missing-event'), (error) => {
    assert.ok(error instanceof MockApiError);
    assert.equal(error.code, 'NOT_FOUND');
    assert.deepEqual(error.toJSON(), { error: { code: 'NOT_FOUND', message: 'Event not found' } });
    return true;
  });
});

test('booking enforces whole quantities, available seats, and supports a declined payment retry', async () => {
  for (const quantity of [0, -1, 1.5, 11]) {
    await assert.rejects(createBooking('lagos-summit-general', quantity), { code: 'VALIDATION' });
  }
  const booking = await createBooking('lagos-summit-general', 2);
  assert.equal(booking.status, 'pending');
  assert.equal(booking.totalCents, 500000);
  const tierAfterBooking = await getEvent('lagos-tech-summit');
  assert.equal(tierAfterBooking.tiers[0].seatsLeft, 112);
  await assert.rejects(createBooking('abuja-jazz-front-row', 1), { code: 'SOLD_OUT' });
  await assert.rejects(createBooking('lagos-summit-vip', 9), { code: 'SOLD_OUT' });
  await assert.rejects(pay(booking.reference, { decline: true }), { code: 'PAYMENT_DECLINED' });
  const paid = await pay(booking.reference);
  assert.equal(paid.status, 'paid');
  await assert.rejects(pay(booking.reference), { code: 'INVALID_TRANSITION' });
});

test('whole-cent prices are formatted as naira in one formatter', () => {
  assert.equal(formatPrice(250000), '₦2,500');
  assert.equal(formatPrice(125050), '₦1,250.5');
});
