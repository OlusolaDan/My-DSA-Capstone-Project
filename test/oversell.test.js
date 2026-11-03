import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createBookingService } from '../src/services/bookingService.js';

test('50 simultaneous SQLite bookings for the last seat produce one success and 49 SOLD_OUT errors', async () => {
  const database = createConnection(':memory:');

  try {
    const repository = createSqliteRepository(database);
    const event = {
      id: 'oversell-test-event',
      organizerId: 'oversell-test-organizer',
      title: 'Last Seat Test',
      city: 'Lagos',
      venue: 'Test Hall',
      date: '2027-12-05T17:00:00Z',
      status: 'published',
    };
    const tier = {
      id: 'oversell-test-tier',
      eventId: event.id,
      name: 'General',
      priceCents: 1000,
      capacity: 1,
      sold: 0,
      seatsLeft: 1,
    };
    await repository.createEvent(event);
    await repository.createTier(tier);

    const bookings = createBookingService(repository, {});
    const results = await Promise.allSettled(
      Array.from({ length: 50 }, (_, index) =>
        bookings.book({ tierId: tier.id, quantity: 1 }, `attendee-${index}`)),
    );
    const succeeded = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    assert.equal(succeeded.length, 1);
    assert.equal(rejected.length, 49);
    assert.ok(rejected.every((result) => result.reason.code === 'SOLD_OUT'));
    assert.equal((await repository.getTier(tier.id)).sold, 1);
    assert.equal(database.prepare('SELECT count(*) AS count FROM bookings').get().count, 1);
  } finally {
    database.close();
  }
});
