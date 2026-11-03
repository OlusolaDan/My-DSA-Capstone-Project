import { createConnection } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';

const database = createConnection();
const repository = createSqliteRepository(database);

try {
  const eventId = 'seed-event-build-5';
  if ((await repository.listEvents()).some((event) => event.id === eventId)) {
    console.log('Seed event already exists; no seed data added.');
  } else {
    const event = {
      id: eventId,
      organizerId: 'seed-organizer-build-5',
      title: 'Lagos Arts Night',
      city: 'Lagos',
      venue: 'Freedom Park',
      date: '2027-12-05T17:00:00Z',
      status: 'published',
    };
    await repository.createEvent(event);
    await repository.createTier({
      id: 'seed-tier-build-5',
      eventId: event.id,
      name: 'General',
      priceCents: 5000,
      capacity: 100,
      sold: 0,
      seatsLeft: 100,
    });
    console.log('Seeded the database with Lagos Arts Night and its General ticket tier.');
  }
} finally {
  database.close();
}
