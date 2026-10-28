import { DomainError } from '../domain/errors.js';

export function createMemoryRepository() {
  const events = new Map();
  const tiers = new Map();
  const bookings = new Map();
  const bookingsByReference = new Map();
  const missing = (name) => { throw new DomainError('NOT_FOUND', `${name} not found`); };
  return {
    async createEvent(event) { events.set(event.id, event); return event; },
    async getEvent(id) { const value = events.get(id); if (!value) missing('Event'); return value; },
    async listEvents() { return [...events.values()]; },
    async updateEvent(event) { if (!events.has(event.id)) missing('Event'); events.set(event.id, event); return event; },
    async createTier(tier) { tiers.set(tier.id, tier); return tier; },
    async getTier(id) { const value = tiers.get(id); if (!value) missing('Tier'); return value; },
    async listTiersForEvent(eventId) { return [...tiers.values()].filter((tier) => tier.eventId === eventId); },
    async updateTier(tier) { if (!tiers.has(tier.id)) missing('Tier'); tiers.set(tier.id, tier); return tier; },
    async createBooking(booking) {
      if (bookingsByReference.has(booking.reference)) throw new DomainError('CONFLICT', 'Booking reference already exists');
      bookings.set(booking.id, booking); bookingsByReference.set(booking.reference, booking.id); return booking;
    },
    async getBookingByReference(reference) {
      const id = bookingsByReference.get(reference); const value = bookings.get(id);
      if (!value) missing('Booking'); return value;
    },
    async updateBooking(booking) { if (!bookings.has(booking.id)) missing('Booking'); bookings.set(booking.id, booking); return booking; },
  };
}
