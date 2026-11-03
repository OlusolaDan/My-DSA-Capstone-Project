import { createConnection } from '../src/db/connection.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';

const database = createConnection(':memory:');
const repository = createSqliteRepository(database);

try {
  const event = {
    id: 'oversell-event',
    organizerId: 'oversell-organizer',
    title: 'Last Seat Demo',
    city: 'Lagos',
    venue: 'Demo Hall',
    date: '2027-12-05T17:00:00Z',
    status: 'published',
  };
  await repository.createEvent(event);
  const tier = {
    id: 'oversell-tier',
    eventId: event.id,
    name: 'General',
    priceCents: 1000,
    capacity: 2,
    sold: 0,
    seatsLeft: 2,
  };
  await repository.createTier(tier);

  const bookings = createBookingService(repository, {});
  await bookings.book({ tierId: tier.id, quantity: 1 }, 'first-attendee');
  console.log(`Starting seats left: ${(await repository.getTier(tier.id)).seatsLeft}`);

  const results = await Promise.allSettled(
    Array.from({ length: 50 }, (_, index) =>
      bookings.book({ tierId: tier.id, quantity: 1 }, `attendee-${index}`)),
  );
  const finalTier = await repository.getTier(tier.id);
  const successes = results.filter((result) => result.status === 'fulfilled').length;
  const soldOut = results.filter(
    (result) => result.status === 'rejected' && result.reason.code === 'SOLD_OUT',
  ).length;
  const unexpectedErrors = results.filter(
    (result) => result.status === 'rejected' && result.reason.code !== 'SOLD_OUT',
  );
  if (unexpectedErrors.length > 0) throw unexpectedErrors[0].reason;

  console.log(`Concurrent booking requests succeeded: ${successes}`);
  console.log(`Concurrent requests rejected as SOLD_OUT: ${soldOut}`);
  console.log(`Seats sold: ${finalTier.sold}/${finalTier.capacity}`);
} finally {
  database.close();
}
