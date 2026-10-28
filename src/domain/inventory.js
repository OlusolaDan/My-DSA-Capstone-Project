import { DomainError } from './errors.js';
import { newId, newReference } from './ids.js';
import { Queue } from './waitlistQueue.js';

const invalid = (message) => { throw new DomainError('VALIDATION', message); };
const requiredText = (value, name) => {
  if (typeof value !== 'string' || value.trim() === '') invalid(`${name} must be a non-empty string`);
  return value.trim();
};
const positiveInteger = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 1) invalid(`${name} must be a positive whole number`);
  return value;
};
const get = (map, id, name) => {
  if (typeof id !== 'string' || id.trim() === '') invalid(`${name} id is required`);
  const value = map.get(id);
  if (!value) throw new DomainError('NOT_FOUND', `${name} not found`);
  return value;
};

export function createStore() {
  return { events: new Map(), tiers: new Map(), bookings: new Map(), bookingsByReference: new Map(), waitlists: new Map() };
}

export function createEvent(store, details) {
  if (!store || !(store.events instanceof Map)) invalid('A valid store is required');
  if (!details || typeof details !== 'object' || Array.isArray(details)) invalid('Event details are required');
  const title = requiredText(details.title, 'title');
  const city = requiredText(details.city, 'city');
  const venue = requiredText(details.venue, 'venue');
  if (typeof details.date !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(details.date) || Number.isNaN(Date.parse(details.date))) invalid('date must be a valid date string');
  const [year, month, day] = details.date.slice(0, 10).split('-').map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) invalid('date must be a real calendar date');
  const event = { id: newId(), title, city, venue, date: details.date, tiers: new Map(), status: 'draft' };
  store.events.set(event.id, event);
  return event;
}

export function addTier(store, eventId, details) {
  if (!store || !(store.events instanceof Map) || !(store.tiers instanceof Map)) invalid('A valid store is required');
  const event = get(store.events, eventId, 'Event');
  if (!details || typeof details !== 'object' || Array.isArray(details)) invalid('Tier details are required');
  const name = requiredText(details.name, 'name');
  if (!Number.isSafeInteger(details.priceCents) || details.priceCents < 0) invalid('priceCents must be a whole non-negative number');
  const capacity = positiveInteger(details.capacity, 'capacity');
  const tier = { id: newId(), eventId: event.id, name, priceCents: details.priceCents, capacity, sold: 0, seatsLeft: capacity };
  event.tiers.set(tier.id, tier);
  store.tiers.set(tier.id, tier);
  store.waitlists.set(tier.id, new Queue());
  return tier;
}

export function publishEvent(store, eventId) {
  if (!store || !(store.events instanceof Map)) invalid('A valid store is required');
  const event = get(store.events, eventId, 'Event');
  if (event.tiers.size === 0) throw new DomainError('INVALID_STATE', 'An event must have at least one ticket tier before publishing');
  event.status = 'published';
  return event;
}

export function listEventSummaries(store, { publishedOnly = true } = {}) {
  if (!store || !(store.events instanceof Map)) invalid('A valid store is required');
  return [...store.events.values()]
    .filter((event) => !publishedOnly || event.status === 'published')
    .map((event) => ({
      id: event.id, title: event.title, city: event.city, venue: event.venue,
      date: event.date, status: event.status,
      tiers: [...event.tiers.values()].map((tier) => ({ ...tier })),
    }));
}

export function bookTickets(store, tierId, attendeeName, quantity) {
  if (!store || !(store.tiers instanceof Map) || !(store.bookingsByReference instanceof Map)) invalid('A valid store is required');
  const tier = get(store.tiers, tierId, 'Tier');
  attendeeName = requiredText(attendeeName, 'attendeeName');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) invalid('quantity must be a whole number from 1 to 10');
  if (tier.seatsLeft < quantity) throw new DomainError('SOLD_OUT', 'Not enough seats remain');
  // All validation and availability checks happen before any inventory mutation.
  let reference = newReference();
  while (store.bookingsByReference.has(reference)) reference = newReference();
  const booking = { id: newId(), reference, tierId: tier.id, eventId: tier.eventId, attendeeName, quantity, totalCents: tier.priceCents * quantity, status: 'confirmed' };
  if (!Number.isSafeInteger(booking.totalCents)) invalid('Booking total exceeds the supported whole-cent range');
  tier.sold += quantity;
  tier.seatsLeft -= quantity;
  store.bookings.set(booking.id, booking);
  store.bookingsByReference.set(reference, booking);
  return booking;
}

export function cancelBooking(store, bookingId) {
  if (!store || !(store.bookings instanceof Map) || !(store.tiers instanceof Map)) invalid('A valid store is required');
  const booking = get(store.bookings, bookingId, 'Booking');
  if (booking.status === 'cancelled') throw new DomainError('INVALID_STATE', 'Booking is already cancelled');
  const tier = get(store.tiers, booking.tierId, 'Tier');
  booking.status = 'cancelled';
  tier.sold -= booking.quantity;
  tier.seatsLeft += booking.quantity;
  return booking;
}

export function findBookingByReference(store, reference) {
  if (!store || !(store.bookingsByReference instanceof Map)) invalid('A valid store is required');
  reference = requiredText(reference, 'reference');
  const booking = store.bookingsByReference.get(reference);
  if (!booking) throw new DomainError('NOT_FOUND', 'Booking not found');
  return booking;
}

export function joinWaitlist(store, tierId, attendeeName) {
  if (!store || !(store.tiers instanceof Map) || !(store.waitlists instanceof Map)) invalid('A valid store is required');
  const tier = get(store.tiers, tierId, 'Tier');
  attendeeName = requiredText(attendeeName, 'attendeeName');
  if (tier.seatsLeft > 0) throw new DomainError('INVALID_STATE', 'Waitlist is only available when the tier is sold out');
  const entry = { id: newId(), tierId: tier.id, attendeeName, joinedAt: new Date().toISOString() };
  store.waitlists.get(tier.id).enqueue(entry);
  return entry;
}
