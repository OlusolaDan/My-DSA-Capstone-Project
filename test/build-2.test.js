import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '../src/domain/errors.js';
import { createStore, createEvent, addTier, publishEvent, listEventSummaries, bookTickets } from '../src/domain/inventory.js';
import { filterEvents, sortEvents, searchEvents } from '../src/domain/eventSearch.js';
import { mergeSort } from '../src/domain/sorting.js';

function rejectsCode(fn, code) {
  assert.throws(fn, (error) => error instanceof DomainError && error.code === code);
}
const create = (s, title, city = 'Lagos', date = '2026-12-05T17:00:00Z', venue = 'Hall') => createEvent(s, { title, city, venue, date });
const summary = (id, title, date, prices = [], seats = []) => ({ id, title, city: 'Lagos', venue: 'Hall', date, tiers: prices.map((priceCents, i) => ({ priceCents, seatsLeft: seats[i] ?? 1 })) });

test('S02: event creation saves a new draft and public listing hides it', () => {
  const store = createStore(); const event = create(store, 'Lagos Tech Meetup');
  assert.notEqual(event.id, undefined); assert.equal(event.status, 'draft');
  assert.deepEqual(listEventSummaries(store), []);
  assert.equal(listEventSummaries(store, { publishedOnly: false })[0].id, event.id);
});
test('S02: missing title, missing city, and impossible date reject without saving', () => {
  const store = createStore();
  for (const details of [
    { title: '', city: 'Lagos', venue: 'Hall', date: '2026-12-05' },
    { title: 'Show', city: ' ', venue: 'Hall', date: '2026-12-05' },
    { title: 'Show', city: 'Lagos', venue: 'Hall', date: '2026-02-30' },
  ]) rejectsCode(() => createEvent(store, details), 'VALIDATION');
  assert.equal(store.events.size, 0);
});

test('S03: adding a tier tracks price, capacity, sold, and seats left', () => {
  const store = createStore(); const event = create(store, 'Show');
  const tier = addTier(store, event.id, { name: 'General', priceCents: 500000, capacity: 100 });
  assert.equal(tier.sold, 0); assert.equal(tier.seatsLeft, 100); assert.equal(tier.priceCents, 500000);
});
test('S03: fractional/negative price and capacity below one reject with VALIDATION', () => {
  const store = createStore(); const event = create(store, 'Show');
  for (const fields of [{ priceCents: 1.5, capacity: 1 }, { priceCents: -1, capacity: 1 }, { priceCents: 1, capacity: 0 }]) rejectsCode(() => addTier(store, event.id, { name: 'General', ...fields }), 'VALIDATION');
});
test('S03: an unknown event rejects tier creation with NOT_FOUND', () => {
  rejectsCode(() => addTier(createStore(), 'missing', { name: 'General', priceCents: 1, capacity: 1 }), 'NOT_FOUND');
});

test('S04: publishing without tiers rejects and leaves the event a draft', () => {
  const store = createStore(); const event = create(store, 'Show');
  rejectsCode(() => publishEvent(store, event.id), 'INVALID_STATE'); assert.equal(event.status, 'draft');
});
test('S04: publishing an event with tiers exposes it in public summaries', () => {
  const store = createStore();
  const event = create(store, 'Show');
  addTier(store, event.id, { name: 'General', priceCents: 100, capacity: 3 });
  assert.equal(publishEvent(store, event.id).status, 'published');
  assert.equal(listEventSummaries(store)[0].id, event.id);
});
test('S04: public summaries hide drafts and organizer summaries include them', () => {
  const store = createStore(); const event = create(store, 'Draft');
  assert.deepEqual(listEventSummaries(store), []);
  assert.equal(listEventSummaries(store, { publishedOnly: false })[0].id, event.id);
});
test('S04: publishing an unknown event returns NOT_FOUND', () => rejectsCode(() => publishEvent(createStore(), 'missing'), 'NOT_FOUND'));

test('S05: query matches title or venue case-insensitively', () => {
  const events = [summary('1', 'Lagos Tech Meetup', '2026-12-01'), summary('2', 'Abuja Night', '2026-12-02')]; events[1].venue = 'Jazz Hall';
  assert.deepEqual(filterEvents(events, { q: 'JAZZ' }).map((e) => e.id), ['2']);
});
test('S05: city matching ignores case but matches the whole city', () => {
  const events = [summary('1', 'A', '2026-12-01'), { ...summary('2', 'B', '2026-12-01'), city: 'Lagos Island' }, { ...summary('3', 'C', '2026-12-01'), city: 'Abuja' }];
  assert.deepEqual(filterEvents(events, { city: 'lagos' }).map((e) => e.id), ['1']);
});
test('S05: price filter uses cheapest tier, excludes no-tier events, then sorts cheapest first', () => {
  const events = [summary('2', 'B', '2026-12-01', [300]), summary('1', 'A', '2026-12-01', [100, 500]), summary('3', 'C', '2026-12-01')];
  assert.deepEqual(searchEvents(events, { maxPriceCents: 300 }, 'price').map((e) => e.id), ['1', '2']);
});
test('S05: date sorting is earliest first with same-day title tie break', () => {
  const events = [summary('2', 'Zulu', '2026-12-05'), summary('3', 'Earlier', '2026-12-04'), summary('1', 'Alpha', '2026-12-05')];
  assert.deepEqual(sortEvents(events, 'date').map((e) => e.id), ['3', '1', '2']);
});
test('S05: date-only to includes the entire day', () => {
  assert.equal(filterEvents([summary('1', 'Evening', '2026-12-05T17:00:00Z')], { to: '2026-12-05' }).length, 1);
});
test('S05: invalid dates, fractional price, and unknown sort option return VALIDATION', () => {
  const events = [summary('1', 'A', '2026-12-01', [100])];
  rejectsCode(() => filterEvents(events, { from: '2026-02-30' }), 'VALIDATION');
  rejectsCode(() => filterEvents(events, { maxPriceCents: 1.5 }), 'VALIDATION');
  rejectsCode(() => sortEvents(events, 'random'), 'VALIDATION');
});
test('S05: filters and sorts return new arrays without changing input order', () => {
  const events = [summary('2', 'B', '2026-12-02'), summary('1', 'A', '2026-12-01')]; const before = [...events];
  const filtered = filterEvents(events, { city: 'lagos' }); const sorted = sortEvents(events, 'date');
  assert.notEqual(filtered, events); assert.notEqual(sorted, events); assert.deepEqual(events, before); assert.deepEqual(events.map((e) => e.id), ['2', '1']);
});
test('S05: availability sorts by seats left, then title and id', () => {
  const events = [summary('3', 'Beta', '2026-12-01', [1], [2]), summary('2', 'Alpha', '2026-12-01', [1], [5]), summary('1', 'Alpha', '2026-12-01', [1], [5])];
  assert.deepEqual(sortEvents(events, 'availability').map((e) => e.id), ['1', '2', '3']);
});
test('search and sorting handle an empty list; merge sort is stable and non-mutating', () => {
  const empty = []; assert.deepEqual(searchEvents(empty, {}, 'date'), []); assert.notEqual(sortEvents(empty, 'price'), empty);
  const input = [{ key: 1, id: 'a' }, { key: 0, id: 'b' }, { key: 1, id: 'c' }]; const output = mergeSort(input, (a, b) => a.key - b.key);
  assert.deepEqual(output.map((x) => x.id), ['b', 'a', 'c']); assert.deepEqual(input.map((x) => x.id), ['a', 'b', 'c']); assert.notEqual(output, input);
});

test('S06: booking two tickets creates a booking and leaves one seat', () => {
  const store = createStore(); const event = create(store, 'Show'); const tier = addTier(store, event.id, { name: 'General', priceCents: 275, capacity: 3 });
  publishEvent(store, event.id); const booking = bookTickets(store, tier.id, 'Ada', 2);
  assert.equal(booking.quantity, 2); assert.equal(booking.status, 'confirmed'); assert.equal(booking.totalCents, 550); assert.equal(tier.seatsLeft, 1);
});
test('S06: oversold booking rejects with SOLD_OUT and changes nothing', () => {
  const store = createStore(); const event = create(store, 'Show'); const tier = addTier(store, event.id, { name: 'General', priceCents: 100, capacity: 1 }); const before = { ...tier };
  rejectsCode(() => bookTickets(store, tier.id, 'Ada', 2), 'SOLD_OUT'); assert.deepEqual(tier, before); assert.equal(store.bookings.size, 0);
});
test('S06: zero, negative, fractional, and over-ten quantities reject with VALIDATION', () => {
  const store = createStore(); const event = create(store, 'Show'); const tier = addTier(store, event.id, { name: 'General', priceCents: 100, capacity: 20 });
  for (const quantity of [0, -1, 1.5, 11]) rejectsCode(() => bookTickets(store, tier.id, 'Ada', quantity), 'VALIDATION');
});
