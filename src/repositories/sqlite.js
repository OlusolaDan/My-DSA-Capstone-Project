import { DomainError } from '../domain/errors.js';
import { createConnection } from '../db/connection.js';

const eventFromRow = (row) => ({
  id: row.id,
  organizerId: row.organizer_id,
  title: row.title,
  city: row.city,
  venue: row.venue,
  date: row.date,
  status: row.status,
});

const tierFromRow = (row) => ({
  id: row.id,
  eventId: row.event_id,
  name: row.name,
  priceCents: row.price_cents,
  capacity: row.capacity,
  sold: row.sold,
  seatsLeft: row.capacity - row.sold,
});

const bookingFromRow = (row) => ({
  id: row.id,
  reference: row.reference,
  eventId: row.event_id,
  tierId: row.tier_id,
  userId: row.user_id,
  quantity: row.quantity,
  totalCents: row.total_cents,
  status: row.status,
});

function throwConstraint(error) {
  if ((error.errcode & 0xff) !== 19) throw error;
  if (error.errcode === 787) {
    throw new DomainError('NOT_FOUND', 'A related record was not found');
  }
  throw new DomainError('CONFLICT', 'A record violates a database constraint');
}

export function createSqliteRepository(database = createConnection()) {
  const missing = (name) => { throw new DomainError('NOT_FOUND', `${name} not found`); };
  const statements = {
    insertUser: database.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)'),
    insertEvent: database.prepare(
      'INSERT INTO events (id, organizer_id, title, city, venue, date, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ),
    getEvent: database.prepare(
      'SELECT id, organizer_id, title, city, venue, date, status FROM events WHERE id = ?',
    ),
    listEvents: database.prepare(
      'SELECT id, organizer_id, title, city, venue, date, status FROM events',
    ),
    updateEvent: database.prepare(
      'UPDATE events SET organizer_id = ?, title = ?, city = ?, venue = ?, date = ?, status = ? WHERE id = ?',
    ),
    insertTier: database.prepare(
      'INSERT INTO ticket_tiers (id, event_id, name, price_cents, capacity, sold) VALUES (?, ?, ?, ?, ?, ?)',
    ),
    getTier: database.prepare(
      'SELECT id, event_id, name, price_cents, capacity, sold FROM ticket_tiers WHERE id = ?',
    ),
    listTiersForEvent: database.prepare(
      'SELECT id, event_id, name, price_cents, capacity, sold FROM ticket_tiers WHERE event_id = ?',
    ),
    updateTier: database.prepare(
      'UPDATE ticket_tiers SET event_id = ?, name = ?, price_cents = ?, capacity = ?, sold = ? WHERE id = ?',
    ),
    reserveTierSeats: database.prepare(
      'UPDATE ticket_tiers SET sold = sold + ? WHERE id = ? AND sold + ? <= capacity',
    ),
    insertBooking: database.prepare(
      'INSERT INTO bookings (id, reference, event_id, tier_id, user_id, quantity, total_cents, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ),
    getBookingByReference: database.prepare(
      'SELECT id, reference, event_id, tier_id, user_id, quantity, total_cents, status FROM bookings WHERE reference = ?',
    ),
    updateBooking: database.prepare(
      'UPDATE bookings SET reference = ?, event_id = ?, tier_id = ?, user_id = ?, quantity = ?, total_cents = ?, status = ? WHERE id = ?',
    ),
  };
  const ensureUser = (id) => statements.insertUser.run(id);

  return {
    async createEvent(event) {
      try {
        ensureUser(event.organizerId);
        statements.insertEvent.run(event.id, event.organizerId, event.title, event.city, event.venue, event.date, event.status);
      } catch (error) {
        throwConstraint(error);
      }
      return event;
    },

    async getEvent(id) {
      const row = statements.getEvent.get(id);
      if (!row) missing('Event');
      return eventFromRow(row);
    },

    async listEvents() {
      return statements.listEvents.all().map(eventFromRow);
    },

    async updateEvent(event) {
      let result;
      try {
        ensureUser(event.organizerId);
        result = statements.updateEvent.run(event.organizerId, event.title, event.city, event.venue, event.date, event.status, event.id);
      } catch (error) {
        throwConstraint(error);
      }
      if (result.changes === 0) missing('Event');
      return event;
    },

    async createTier(tier) {
      try {
        statements.insertTier.run(tier.id, tier.eventId, tier.name, tier.priceCents, tier.capacity, tier.sold);
      } catch (error) {
        throwConstraint(error);
      }
      return tier;
    },

    async getTier(id) {
      const row = statements.getTier.get(id);
      if (!row) missing('Tier');
      return tierFromRow(row);
    },

    async listTiersForEvent(eventId) {
      return statements.listTiersForEvent.all(eventId).map(tierFromRow);
    },

    async updateTier(tier) {
      let result;
      try {
        result = statements.updateTier.run(tier.eventId, tier.name, tier.priceCents, tier.capacity, tier.sold, tier.id);
      } catch (error) {
        throwConstraint(error);
      }
      if (result.changes === 0) missing('Tier');
      return { ...tier, seatsLeft: tier.capacity - tier.sold };
    },

    async reserveTierSeats(tierId, quantity) {
      const result = statements.reserveTierSeats.run(quantity, tierId, quantity);
      if (result.changes === 0) throw new DomainError('SOLD_OUT', 'Not enough seats remain');
      return tierFromRow(statements.getTier.get(tierId));
    },

    async createBooking(booking) {
      try {
        ensureUser(booking.userId);
        statements.insertBooking.run(booking.id, booking.reference, booking.eventId, booking.tierId,
          booking.userId, booking.quantity, booking.totalCents, booking.status);
      } catch (error) {
        throwConstraint(error);
      }
      return booking;
    },

    async getBookingByReference(reference) {
      const row = statements.getBookingByReference.get(reference);
      if (!row) missing('Booking');
      return bookingFromRow(row);
    },

    async updateBooking(booking) {
      let result;
      try {
        result = statements.updateBooking.run(booking.reference, booking.eventId, booking.tierId,
          booking.userId, booking.quantity, booking.totalCents, booking.status, booking.id);
      } catch (error) {
        throwConstraint(error);
      }
      if (result.changes === 0) missing('Booking');
      return booking;
    },
  };
}
