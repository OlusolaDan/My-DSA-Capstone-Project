import { listEvents } from '../api.js';
import { el, formatEventDate, formatPrice } from '../ui.js';

const form = document.querySelector('#event-filters');
const citySelect = form.elements.city;
const eventList = document.querySelector('#event-list');
const resultCount = document.querySelector('#result-count');

function eventCard(event) {
  const cheapest = Math.min(...event.tiers.map((tier) => tier.priceCents));
  const card = el('article', { className: 'event-card' }, [
    el('div', { className: 'event-card-top' }, [
      el('span', { className: 'event-city' }, event.city),
      el('span', { className: 'event-date' }, formatEventDate(event.date)),
    ]),
    el('h3', {}, event.title),
    el('p', { className: 'event-venue' }, event.venue),
    el('div', { className: 'event-card-bottom' }, [
      el('p', { className: 'starting-price' }, [
        el('span', { className: 'meta-label' }, 'Tickets from'),
        el('strong', {}, formatPrice(cheapest)),
      ]),
      el('a', { className: 'button button-dark', href: `./event.html?id=${encodeURIComponent(event.id)}` }, 'View event'),
    ]),
  ]);
  return card;
}

async function renderEvents() {
  eventList.setAttribute('aria-busy', 'true');
  resultCount.textContent = 'Loading events…';
  try {
    const maxPrice = form.elements.maxPrice.value;
    const criteria = {
      q: form.elements.q.value.trim(),
      city: citySelect.value,
      sortBy: form.elements.sortBy.value,
    };
    if (maxPrice !== '') {
      const maxPriceCents = Number(maxPrice) * 100;
      const roundedCents = Math.round(maxPriceCents);
      if (!Number.isFinite(maxPriceCents) || maxPriceCents < 0 || Math.abs(maxPriceCents - roundedCents) > 1e-8) {
        throw new Error('Enter a maximum price with no more than two decimal places.');
      }
      criteria.maxPriceCents = roundedCents;
    }
    const found = await listEvents(criteria);
    eventList.replaceChildren(...found.map(eventCard));
    resultCount.textContent = `${found.length} ${found.length === 1 ? 'event' : 'events'} to explore`;
    if (found.length === 0) {
      eventList.append(el('p', { className: 'empty-state' }, 'No events match those filters. Try changing your search.'));
    }
  } catch (error) {
    eventList.replaceChildren(el('p', { className: 'error-message', role: 'alert' }, error.message));
  } finally {
    eventList.setAttribute('aria-busy', 'false');
  }
}

async function populateCities() {
  const events = await listEvents();
  const cities = [...new Set(events.map((event) => event.city))].sort((a, b) => a.localeCompare(b));
  citySelect.append(...cities.map((city) => el('option', { value: city }, city)));
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  renderEvents();
});
form.addEventListener('reset', () => requestAnimationFrame(renderEvents));

try {
  await populateCities();
  await renderEvents();
} catch (error) {
  eventList.replaceChildren(el('p', { className: 'error-message', role: 'alert' }, error.message));
  eventList.setAttribute('aria-busy', 'false');
}
