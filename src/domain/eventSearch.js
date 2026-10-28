import { DomainError } from './errors.js';
import { mergeSort } from './sorting.js';

const validation = (message) => { throw new DomainError('VALIDATION', message); };
const tiersOf = (event) => Array.isArray(event.tiers) ? event.tiers : [];
const cheapestPrice = (event) => {
  const tiers = tiersOf(event);
  return tiers.length ? Math.min(...tiers.map((tier) => tier.priceCents)) : null;
};
const available = (event) => tiersOf(event).reduce((sum, tier) => sum + (tier.seatsLeft ?? 0), 0);
const textCompare = (a, b) => String(a ?? '').localeCompare(String(b ?? ''));

function parseDate(value, name, endOfDate = false) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || Number.isNaN(Date.parse(value))) validation(`${name} must be a valid date`);
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) validation(`${name} must be a real date`);
  if (endOfDate && value.length === 10) return `${value}T23:59:59.999Z`;
  return value;
}

export function filterEvents(summaries, { q, city, from, to, maxPriceCents, onlyAvailable } = {}) {
  const start = parseDate(from, 'from');
  const end = parseDate(to, 'to', true);
  if (maxPriceCents !== undefined && (!Number.isSafeInteger(maxPriceCents) || maxPriceCents < 0)) validation('maxPriceCents must be a whole non-negative number');
  const query = typeof q === 'string' ? q.trim().toLocaleLowerCase() : '';
  const wantedCity = typeof city === 'string' ? city.toLocaleLowerCase() : '';
  return summaries.filter((event) => {
    if (query && !`${event.title ?? ''} ${event.venue ?? ''}`.toLocaleLowerCase().includes(query)) return false;
    if (wantedCity && String(event.city ?? '').toLocaleLowerCase() !== wantedCity) return false;
    const date = event.date;
    if (start && date < start) return false;
    if (end && date > end) return false;
    if (maxPriceCents !== undefined) {
      const price = cheapestPrice(event);
      if (price === null || price > maxPriceCents) return false;
    }
    if (onlyAvailable && available(event) <= 0) return false;
    return true;
  });
}

export function sortEvents(summaries, sortBy) {
  if (!['date', 'price', 'availability'].includes(sortBy)) validation('Unknown event sort option');
  const primary = (a, b) => {
    if (sortBy === 'date') return textCompare(a.date, b.date);
    if (sortBy === 'price') {
      const ap = cheapestPrice(a); const bp = cheapestPrice(b);
      if (ap === null || bp === null) return ap === bp ? 0 : ap === null ? 1 : -1;
      return ap - bp;
    }
    return available(b) - available(a);
  };
  return mergeSort(summaries, (a, b) => primary(a, b) || textCompare(a.title, b.title) || textCompare(a.id, b.id));
}

export function searchEvents(summaries, criteria, sortBy) {
  return sortEvents(filterEvents(summaries, criteria), sortBy);
}
