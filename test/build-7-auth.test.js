import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApplication } from '../src/server.js';
import { createMemoryRepository } from '../src/repositories/memory.js';
import { hashPassword, verifyPassword } from '../src/lib/password.js';
import { signToken, verifyToken } from '../src/lib/token.js';

const TOKEN_SECRET = 'build-7-test-secret-0123456789abcdef';

async function start(options = {}) {
  const app = createApplication({ tokenSecret: TOKEN_SECRET, ...options });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  return { app, base: `http://127.0.0.1:${app.address().port}` };
}

async function signup(base, email, role = 'attendee') {
  const response = await fetch(`${base}/api/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'secure-password-1', role }),
  });
  return { response, result: await response.json() };
}

const authHeaders = (token) => ({ authorization: `Bearer ${token}` });
const postJson = (token, body) => ({
  method: 'POST',
  headers: { ...authHeaders(token), 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

test('password hashes use different random salts and verify with scrypt', async () => {
  const firstHash = await hashPassword('correct horse battery');
  const secondHash = await hashPassword('correct horse battery');
  assert.notEqual(firstHash, secondHash);
  assert.equal(await verifyPassword('correct horse battery', firstHash), true);
  assert.equal(await verifyPassword('wrong password', firstHash), false);
  assert.equal(await verifyPassword('correct horse battery', 'not-a-scrypt-hash'), false);
});

test('HS256 tokens verify, reject other algorithms and reject expired signatures', () => {
  const now = 1_800_000_000_000;
  const token = signToken({ sub: 'user-1', role: 'attendee' }, { secret: TOKEN_SECRET, now, expiresInSeconds: 60 });
  assert.deepEqual(verifyToken(token, { secret: TOKEN_SECRET, now }), {
    sub: 'user-1',
    role: 'attendee',
    iat: 1_800_000_000,
    exp: 1_800_000_060,
  });

  const [header, payload, signature] = token.split('.');
  const wrongAlgorithm = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${payload}.${signature}`;
  assert.throws(() => verifyToken(wrongAlgorithm, { secret: TOKEN_SECRET, now }), { code: 'UNAUTHENTICATED' });
  assert.throws(() => verifyToken(`${header}.${payload}.${'A'.repeat(43)}`, { secret: TOKEN_SECRET, now }), { code: 'UNAUTHENTICATED' });
  assert.throws(() => verifyToken(token, { secret: TOKEN_SECRET, now: now + 60_000 }), { code: 'UNAUTHENTICATED' });
});

test('signup returns a safe user and token, normalizes email, and rejects repeated or weak credentials', async () => {
  const repository = createMemoryRepository();
  const { app, base } = await start({ repository });
  try {
    const { response, result } = await signup(base, '  Person@Example.test ', 'attendee');
    assert.equal(response.status, 201);
    assert.equal(result.user.email, 'person@example.test');
    assert.equal(result.user.role, 'attendee');
    assert.equal(typeof result.token, 'string');
    assert.equal(JSON.stringify(result).includes('secure-password-1'), false);
    assert.equal(Object.hasOwn(result.user, 'passwordHash'), false);
    const stored = await repository.getUserByEmail(result.user.email);
    assert.match(stored.passwordHash, /^scrypt\$/);
    assert.equal(stored.passwordHash.includes('secure-password-1'), false);

    const duplicate = await signup(base, 'PERSON@example.test');
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.result.error.code, 'EMAIL_TAKEN');

    const weakPassword = await fetch(`${base}/api/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'another@example.test', password: 'short' }),
    });
    assert.equal(weakPassword.status, 400);
    assert.equal((await weakPassword.json()).error.code, 'VALIDATION');
  } finally {
    app.close();
    await once(app, 'close');
  }
});

test('login returns the same INVALID_CREDENTIALS error for unknown email and wrong password', async () => {
  const { app, base } = await start();
  try {
    await signup(base, 'person@example.test');
    const login = (email, password) => fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const wrongPassword = await login('person@example.test', 'wrong-password');
    const unknownEmail = await login('unknown@example.test', 'wrong-password');
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.deepEqual(await wrongPassword.json(), await unknownEmail.json());

    const success = await login('PERSON@example.test', 'secure-password-1');
    assert.equal(success.status, 200);
    const result = await success.json();
    assert.equal(result.user.email, 'person@example.test');
    assert.equal(typeof result.token, 'string');
  } finally {
    app.close();
    await once(app, 'close');
  }
});

test('protected routes reject missing, malformed and expired tokens and enforce role claims', async () => {
  const { app, base } = await start();
  try {
    const { result } = await signup(base, 'attendee@example.test');
    const noToken = await fetch(`${base}/api/auth/me`);
    const malformed = await fetch(`${base}/api/auth/me`, { headers: authHeaders('not.a.token') });
    const expiredToken = signToken(
      { sub: result.user.id, role: 'attendee' },
      { secret: TOKEN_SECRET, now: Date.now() - 10_000, expiresInSeconds: 1 },
    );
    const expired = await fetch(`${base}/api/auth/me`, { headers: authHeaders(expiredToken) });
    for (const response of [noToken, malformed, expired]) {
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error.code, 'UNAUTHENTICATED');
    }

    const forbidden = await fetch(`${base}/api/events`, postJson(result.token, {
      title: 'Not allowed',
      city: 'Lagos',
      venue: 'Hall',
      date: '2027-12-05',
    }));
    assert.equal(forbidden.status, 403);
    assert.equal((await forbidden.json()).error.code, 'FORBIDDEN');

    const me = await fetch(`${base}/api/auth/me`, { headers: authHeaders(result.token) });
    const profile = await me.json();
    assert.deepEqual(profile.user, result.user);
    assert.equal(JSON.stringify(profile).includes('password'), false);
  } finally {
    app.close();
    await once(app, 'close');
  }
});

test('attendees can list and read only their own bookings', async () => {
  const { app, base } = await start();
  try {
    const { result: organizer } = await signup(base, 'organizer@example.test', 'organizer');
    const { result: attendeeA } = await signup(base, 'attendee-a@example.test');
    const { result: attendeeB } = await signup(base, 'attendee-b@example.test');
    const createdEvent = await fetch(`${base}/api/events`, postJson(organizer.token, {
      title: 'Private booking test',
      city: 'Lagos',
      venue: 'Hall',
      date: '2027-12-05',
    }));
    const event = await createdEvent.json();
    const createdTier = await fetch(`${base}/api/events/${event.id}/tiers`, postJson(organizer.token, {
      name: 'General',
      priceCents: 500,
      capacity: 2,
    }));
    const tier = await createdTier.json();
    await fetch(`${base}/api/events/${event.id}/publish`, postJson(organizer.token, {}));
    const createdBooking = await fetch(`${base}/api/bookings`, postJson(attendeeA.token, {
      tierId: tier.id,
      quantity: 1,
    }));
    const booking = await createdBooking.json();

    const ownList = await fetch(`${base}/api/bookings`, { headers: authHeaders(attendeeA.token) });
    assert.deepEqual((await ownList.json()).map((item) => item.reference), [booking.reference]);
    const ownRead = await fetch(`${base}/api/bookings/${booking.reference}`, { headers: authHeaders(attendeeA.token) });
    assert.equal((await ownRead.json()).reference, booking.reference);

    const otherRead = await fetch(`${base}/api/bookings/${booking.reference}`, { headers: authHeaders(attendeeB.token) });
    assert.equal(otherRead.status, 404);
    assert.equal((await otherRead.json()).error.code, 'NOT_FOUND');
    const otherCancel = await fetch(`${base}/api/bookings/${booking.reference}/cancel`, postJson(attendeeB.token, {}));
    assert.equal(otherCancel.status, 404);
    assert.equal((await otherCancel.json()).error.code, 'NOT_FOUND');
  } finally {
    app.close();
    await once(app, 'close');
  }
});
