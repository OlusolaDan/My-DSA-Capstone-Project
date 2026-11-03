import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createConnection } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';

test('SQLite repository persists events, tiers, and bookings and enforces capacity constraints', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ticket-sqlite-'));
  const databasePath = path.join(directory, 'ticketing.sqlite');
  let database = createConnection(databasePath);

  try {
    let repository = createSqliteRepository(database);
    const event = {
      id: 'event-1',
      organizerId: 'organizer-1',
      title: 'Lagos Arts Night',
      city: 'Lagos',
      venue: 'Freedom Park',
      date: '2027-12-05T17:00:00Z',
      status: 'draft',
    };
    await repository.createEvent(event);
    assert.deepEqual(await repository.getEvent(event.id), event);
    assert.equal((await repository.listEvents()).length, 1);

    event.status = 'published';
    await repository.updateEvent(event);
    assert.equal((await repository.getEvent(event.id)).status, 'published');

    const tier = {
      id: 'tier-1',
      eventId: event.id,
      name: 'General',
      priceCents: 5000,
      capacity: 2,
      sold: 0,
      seatsLeft: 2,
    };
    await repository.createTier(tier);
    assert.deepEqual(await repository.getTier(tier.id), tier);
    assert.equal((await repository.listTiersForEvent(event.id)).length, 1);

    tier.sold = 1;
    tier.seatsLeft = 1;
    await repository.updateTier(tier);
    assert.equal((await repository.getTier(tier.id)).seatsLeft, 1);
    assert.throws(
      () => database.prepare('UPDATE ticket_tiers SET sold = ? WHERE id = ?').run(3, tier.id),
      (error) => /CHECK constraint failed/.test(error.message),
    );

    const booking = {
      id: 'booking-1',
      reference: 'ET-ABCD-2345',
      eventId: event.id,
      tierId: tier.id,
      userId: 'attendee-1',
      quantity: 1,
      totalCents: 5000,
      status: 'pending',
    };
    await repository.createBooking(booking);
    assert.deepEqual(await repository.getBookingByReference(booking.reference), booking);
    booking.status = 'paid';
    await repository.updateBooking(booking);
    assert.equal((await repository.getBookingByReference(booking.reference)).status, 'paid');

    database.close();
    database = createConnection(databasePath);
    repository = createSqliteRepository(database);
    assert.equal((await repository.getEvent(event.id)).status, 'published');
    assert.equal((await repository.getTier(tier.id)).sold, 1);
    assert.equal((await repository.getBookingByReference(booking.reference)).status, 'paid');
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
