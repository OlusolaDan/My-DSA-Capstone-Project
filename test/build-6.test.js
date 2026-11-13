import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, createBooking, listEvents } from '../public/js/api.js';
import { formatPrice } from '../public/js/ui.js';

test('browser API sends the saved bearer token and serializes event and booking requests', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.sessionStorage;
  const stored = new Map([['gather.authToken', 'header.payload.signature']]);
  const requests = [];
  globalThis.sessionStorage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  };
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => url.startsWith('/api/events') ? [] : { reference: 'ET-ABCD-2345' } };
  };
  try {
    await listEvents({ q: 'jazz', city: 'Abuja', maxPriceCents: 500000, sortBy: 'price' });
    await createBooking('tier id', 2);
    assert.equal(requests[0].url, '/api/events?q=jazz&city=Abuja&maxPriceCents=500000&sortBy=price');
    assert.equal(requests[0].options.headers.authorization, 'Bearer header.payload.signature');
    assert.deepEqual(JSON.parse(requests[1].options.body), { tierId: 'tier id', quantity: 2 });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = originalStorage;
  }
});

test('browser API exposes structured HTTP errors and prices remain formatted from cents', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: { code: 'UNAUTHENTICATED', message: 'A valid bearer token is required' } }),
  });
  try {
    await assert.rejects(listEvents(), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'UNAUTHENTICATED');
      assert.equal(error.status, 401);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(formatPrice(250000), '₦2,500');
  assert.equal(formatPrice(125050), '₦1,250.5');
});
