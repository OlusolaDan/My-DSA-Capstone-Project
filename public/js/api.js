import { events } from './mockData.js';

const HOLD_DURATION_MS = 10 * 60 * 1000;
const bookings = new Map();
let nextBookingId = 1;

export class MockApiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MockApiError';
    this.code = code;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message } };
  }
}

function error(code, message) {
  throw new MockApiError(code, message);
}

function copyEvent(event) {
  return { ...event, tiers: event.tiers.map((tier) => ({ ...tier })) };
}

function filterAndSort(eventsToSearch, criteria) {
  const { q = '', city = '', from, to, maxPriceCents, onlyAvailable } = criteria;
  if (maxPriceCents !== undefined && (!Number.isSafeInteger(maxPriceCents) || maxPriceCents < 0)) {
    error('VALIDATION', 'maxPriceCents must be a whole non-negative number');
  }
  const query = typeof q === 'string' ? q.trim().toLocaleLowerCase() : '';
  const wantedCity = typeof city === 'string' ? city.trim().toLocaleLowerCase() : '';
  const filtered = eventsToSearch.filter((event) => {
    if (query && !`${event.title} ${event.venue}`.toLocaleLowerCase().includes(query)) return false;
    if (wantedCity && event.city.toLocaleLowerCase() !== wantedCity) return false;
    if (from && event.date < from) return false;
    if (to && event.date > (to.length === 10 ? `${to}T23:59:59.999Z` : to)) return false;
    if (maxPriceCents !== undefined) {
      const cheapest = Math.min(...event.tiers.map((tier) => tier.priceCents));
      if (event.tiers.length === 0 || cheapest > maxPriceCents) return false;
    }
    if (onlyAvailable && event.tiers.every((tier) => tier.seatsLeft <= 0)) return false;
    return true;
  });
  const sortBy = criteria.sortBy ?? 'date';
  if (!['date', 'price', 'availability'].includes(sortBy)) error('VALIDATION', 'Unknown event sort option');
  const cheapest = (event) => event.tiers.length ? Math.min(...event.tiers.map((tier) => tier.priceCents)) : null;
  const seatsLeft = (event) => event.tiers.reduce((sum, tier) => sum + tier.seatsLeft, 0);
  const compareText = (a, b) => String(a ?? '').localeCompare(String(b ?? ''));
  const compare = (a, b) => {
    let order = 0;
    if (sortBy === 'date') order = compareText(a.date, b.date);
    if (sortBy === 'price') {
      const aPrice = cheapest(a);
      const bPrice = cheapest(b);
      order = aPrice === null || bPrice === null
        ? aPrice === bPrice ? 0 : aPrice === null ? 1 : -1
        : aPrice - bPrice;
    }
    if (sortBy === 'availability') order = seatsLeft(b) - seatsLeft(a);
    return order || compareText(a.title, b.title) || compareText(a.id, b.id);
  };
  return filtered.sort(compare);
}

function expireHolds(now = Date.now()) {
  for (const booking of bookings.values()) {
    if (booking.status !== 'pending' || Date.parse(booking.holdExpiresAt) > now) continue;
    booking.status = 'expired';
    const tier = events.flatMap((event) => event.tiers).find((item) => item.id === booking.tierId);
    if (tier) {
      tier.sold -= booking.quantity;
      tier.seatsLeft += booking.quantity;
    }
  }
}

export async function listEvents(criteria = {}) {
  expireHolds();
  const published = events.filter((event) => event.status === 'published').map(copyEvent);
  if (dateInvalid(criteria.from) || dateInvalid(criteria.to)) error('VALIDATION', 'Event dates must be valid ISO date strings');
  return filterAndSort(published, criteria);
}

function dateInvalid(value) {
  if (value === undefined || value === '') return false;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || Number.isNaN(Date.parse(value))) return true;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day;
}

export async function getEvent(eventId) {
  expireHolds();
  const event = events.find((item) => item.id === eventId && item.status === 'published');
  if (!event) error('NOT_FOUND', 'Event not found');
  return copyEvent(event);
}

export async function createBooking(tierId, quantity) {
  expireHolds();
  if (typeof tierId !== 'string' || !tierId) error('VALIDATION', 'tierId must be a non-empty string');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
    error('VALIDATION', 'quantity must be a whole number from 1 to 10');
  }
  const event = events.find((item) => item.tiers.some((tier) => tier.id === tierId));
  if (!event || event.status !== 'published') error('NOT_FOUND', 'Ticket tier not found');
  const tier = event.tiers.find((item) => item.id === tierId);
  if (tier.seatsLeft < quantity) error('SOLD_OUT', 'Not enough seats remain');
  const totalCents = tier.priceCents * quantity;
  if (!Number.isSafeInteger(totalCents)) error('VALIDATION', 'Booking total exceeds the supported whole-cent range');

  const id = `mock-booking-${nextBookingId++}`;
  const booking = {
    id,
    reference: `MOCK-${String(nextBookingId - 1).padStart(6, '0')}`,
    eventId: event.id,
    tierId: tier.id,
    userId: 'attendee-demo',
    quantity,
    totalCents,
    status: 'pending',
    holdExpiresAt: new Date(Date.now() + HOLD_DURATION_MS).toISOString(),
  };
  tier.sold += quantity;
  tier.seatsLeft -= quantity;
  bookings.set(booking.reference, booking);
  return { ...booking };
}

export async function pay(reference, { decline = false } = {}) {
  expireHolds();
  const booking = bookings.get(reference);
  if (!booking) error('NOT_FOUND', 'Booking not found');
  if (booking.status !== 'pending') error('INVALID_TRANSITION', 'Only pending bookings can be paid');
  if (decline) error('PAYMENT_DECLINED', 'Mock payment was declined');
  booking.status = 'paid';
  return { ...booking };
}
