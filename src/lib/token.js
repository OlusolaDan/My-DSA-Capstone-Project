import { createHmac, timingSafeEqual } from 'node:crypto';
import { DomainError } from '../domain/errors.js';

const TOKEN_LIFETIME_SECONDS = 60 * 60;

function getSecret(secret) {
  const value = secret ?? process.env.AUTH_TOKEN_SECRET;
  if (typeof value !== 'string' || Buffer.byteLength(value) < 32) {
    throw new Error('AUTH_TOKEN_SECRET must contain at least 32 bytes');
  }
  return value;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function unauthenticated() {
  throw new DomainError('UNAUTHENTICATED', 'A valid bearer token is required');
}

export function signToken({ sub, role }, { secret, expiresInSeconds = TOKEN_LIFETIME_SECONDS, now = Date.now() } = {}) {
  if (typeof sub !== 'string' || !sub || typeof role !== 'string') {
    throw new TypeError('Token subject and role are required');
  }
  if (!Number.isSafeInteger(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new TypeError('Token lifetime must be a positive whole number of seconds');
  }

  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const issuedAt = Math.floor(now / 1000);
  const payload = encode({ sub, role, iat: issuedAt, exp: issuedAt + expiresInSeconds });
  const content = `${header}.${payload}`;
  const signature = createHmac('sha256', getSecret(secret)).update(content).digest('base64url');
  return `${content}.${signature}`;
}

export function verifyToken(token, { secret, now = Date.now() } = {}) {
  if (typeof token !== 'string') unauthenticated();
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) unauthenticated();

  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    unauthenticated();
  }
  if (!header || header.alg !== 'HS256') unauthenticated();
  if (!payload || typeof payload.sub !== 'string' || !payload.sub
    || typeof payload.role !== 'string' || !Number.isSafeInteger(payload.exp)
    || !Number.isSafeInteger(payload.iat) || payload.exp <= Math.floor(now / 1000)) {
    unauthenticated();
  }

  const content = `${parts[0]}.${parts[1]}`;
  const expected = createHmac('sha256', getSecret(secret)).update(content).digest();
  let supplied;
  try {
    supplied = Buffer.from(parts[2], 'base64url');
  } catch {
    unauthenticated();
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) unauthenticated();
  return payload;
}
