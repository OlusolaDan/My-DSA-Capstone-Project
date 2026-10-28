import { DomainError } from '../domain/errors.js';
import { newId } from '../domain/ids.js';
import { filterEvents, sortEvents } from '../domain/eventSearch.js';

const validation = (message) => { throw new DomainError('VALIDATION', message); };
const requiredText = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) validation(`${name} must be a non-empty string`);
  return value.trim();
};

export function createEventService(repository) {
  return {
    async create(details, userId) {
      requiredText(userId, 'x-user-id');
      if (!details || typeof details !== 'object' || Array.isArray(details)) validation('Event details are required');
      const title = requiredText(details.title, 'title');
      const city = requiredText(details.city, 'city');
      const venue = requiredText(details.venue, 'venue');
      if (typeof details.date !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(details.date) || Number.isNaN(Date.parse(details.date))) validation('date must be a valid date string');
      const [year, month, day] = details.date.slice(0, 10).split('-').map(Number);
      const calendar = new Date(Date.UTC(year, month - 1, day));
      if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) validation('date must be a real calendar date');
      return repository.createEvent({ id: newId(), organizerId: userId, title, city, venue, date: details.date, status: 'draft' });
    },
    async addTier(eventId, details, userId) {
      requiredText(userId, 'x-user-id');
      const event = await repository.getEvent(eventId);
      if (event.organizerId !== userId) throw new DomainError('FORBIDDEN', 'Only the event organizer can add tiers');
      if (!details || typeof details !== 'object' || Array.isArray(details)) validation('Tier details are required');
      const name = requiredText(details.name, 'name');
      if (!Number.isSafeInteger(details.priceCents) || details.priceCents < 0) validation('priceCents must be a whole non-negative number');
      if (!Number.isSafeInteger(details.capacity) || details.capacity < 1) validation('capacity must be a positive whole number');
      return repository.createTier({ id: newId(), eventId, name, priceCents: details.priceCents, capacity: details.capacity, sold: 0, seatsLeft: details.capacity });
    },
    async publish(eventId, userId) {
      requiredText(userId, 'x-user-id');
      const event = await repository.getEvent(eventId);
      if (event.organizerId !== userId) throw new DomainError('FORBIDDEN', 'Only the event organizer can publish it');
      if ((await repository.listTiersForEvent(eventId)).length === 0) throw new DomainError('INVALID_STATE', 'An event must have at least one ticket tier before publishing');
      event.status = 'published'; return repository.updateEvent(event);
    },
    async search(criteria = {}, sortBy = 'date') {
      const events = (await repository.listEvents()).filter((event) => event.status === 'published');
      const summaries = await Promise.all(events.map(async (event) => ({ ...event, tiers: await repository.listTiersForEvent(event.id) })));
      return sortEvents(filterEvents(summaries, criteria), sortBy);
    },
  };
}
