import { getToken } from './session.js';

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new ApiError(
      payload.error?.code ?? 'HTTP_ERROR',
      payload.error?.message ?? 'The request could not be completed',
      response.status,
    );
  }
  return payload;
}

export function signup(details) {
  return request('/api/auth/signup', { method: 'POST', body: details });
}

export function login(credentials) {
  return request('/api/auth/login', { method: 'POST', body: credentials });
}

export function me() {
  return request('/api/auth/me');
}

export function listEvents(criteria = {}) {
  const query = new URLSearchParams();
  for (const key of ['q', 'city', 'from', 'to', 'maxPriceCents', 'onlyAvailable', 'sortBy']) {
    if (criteria[key] !== undefined && criteria[key] !== '') query.set(key, String(criteria[key]));
  }
  const serialized = query.toString();
  const suffix = serialized ? `?${serialized}` : '';
  return request(`/api/events${suffix}`);
}

export function getEvent(eventId) {
  return request(`/api/events/${encodeURIComponent(eventId)}`);
}

export function createBooking(tierId, quantity) {
  return request('/api/bookings', { method: 'POST', body: { tierId, quantity } });
}

export function pay(reference, { decline = false } = {}) {
  return request(`/api/bookings/${encodeURIComponent(reference)}/pay`, {
    method: 'POST',
    body: { decline },
  });
}

export function listBookings() {
  return request('/api/bookings');
}

export function getBooking(reference) {
  return request(`/api/bookings/${encodeURIComponent(reference)}`);
}

export function cancelBooking(reference) {
  return request(`/api/bookings/${encodeURIComponent(reference)}/cancel`, { method: 'POST' });
}

export function createEvent(details) {
  return request('/api/events', { method: 'POST', body: details });
}

export function addTier(eventId, details) {
  return request(`/api/events/${encodeURIComponent(eventId)}/tiers`, { method: 'POST', body: details });
}

export function publishEvent(eventId) {
  return request(`/api/events/${encodeURIComponent(eventId)}/publish`, { method: 'POST' });
}
