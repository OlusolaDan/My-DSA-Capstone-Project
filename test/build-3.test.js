import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DomainError } from '../src/domain/errors.js';
import { BOOKING_STATES, BOOKING_TRANSITIONS, canTransition, assertTransition } from '../src/domain/bookingStateMachine.js';
import { createRouter } from '../src/http/router.js';
import { createApp } from '../src/http/app.js';

test('booking state machine declares the five states and accepts every allowed move', () => {
  assert.deepEqual(BOOKING_STATES, ['pending', 'paid', 'cancelled', 'refunded', 'checked_in']);
  for (const [from, destinations] of Object.entries(BOOKING_TRANSITIONS)) {
    for (const to of destinations) {
      assert.equal(canTransition(from, to), true);
      assert.equal(assertTransition(from, to), true);
    }
  }
});

test('booking state machine rejects every illegal move with INVALID_TRANSITION', () => {
  for (const from of BOOKING_STATES) {
    for (const to of BOOKING_STATES) {
      if (BOOKING_TRANSITIONS[from].includes(to)) continue;
      assert.equal(canTransition(from, to), false);
      assert.throws(() => assertTransition(from, to), (error) => error instanceof DomainError && error.code === 'INVALID_TRANSITION');
    }
  }
  assert.throws(() => assertTransition('unknown', 'paid'), (error) => error.code === 'INVALID_TRANSITION');
});

test('router matches methods, static paths, and decoded :params', () => {
  const router = createRouter();
  const handler = () => 'ok'; router.get('/api/events/:eventId', handler);
  assert.deepEqual(router.match('GET', '/api/events/event%201'), { handler, params: { eventId: 'event 1' } });
  assert.equal(router.match('POST', '/api/events/event%201'), null);
  assert.equal(router.match('GET', '/api/events'), null);
});

test('GET /health responds to a real HTTP request with JSON status', async () => {
  const app = createApp(); app.listen(0, '127.0.0.1'); await once(app, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${app.address().port}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  } finally { app.close(); await once(app, 'close'); }
});

test('HTTP app returns JSON errors and prevents static path traversal', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'ticket-app-'));
  const publicDir = path.join(temp, 'public');
  await mkdir(publicDir); await writeFile(path.join(publicDir, 'index.html'), 'safe');
  await writeFile(path.join(temp, 'secret.txt'), 'secret');
  const app = createApp({ publicDir }); app.listen(0, '127.0.0.1'); await once(app, 'listening');
  try {
    const base = `http://127.0.0.1:${app.address().port}`;
    const missing = await fetch(`${base}/api/missing`);
    assert.equal(missing.status, 404); assert.deepEqual(await missing.json(), { error: { code: 'NOT_FOUND', message: 'API route not found' } });
    const badJson = await fetch(`${base}/api/missing`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    assert.equal(badJson.status, 400); assert.deepEqual(await badJson.json(), { error: { code: 'BAD_JSON', message: 'Request body must contain valid JSON' } });
    const traversal = await fetch(`${base}/%2e%2e/secret.txt`);
    assert.equal(traversal.status, 404); assert.notEqual(await traversal.text(), 'secret');
    const index = await fetch(base); assert.equal(await index.text(), 'safe');
  } finally {
    app.close(); await once(app, 'close'); await rm(temp, { recursive: true, force: true });
  }
});
