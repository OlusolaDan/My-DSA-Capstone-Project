import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 32;
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const SALT_LENGTH = 16;

export async function hashPassword(password) {
  if (typeof password !== 'string') throw new TypeError('Password must be a string');
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
  });
  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password, encodedHash) {
  if (typeof password !== 'string' || typeof encodedHash !== 'string') return false;
  const parts = encodedHash.split('$');
  if (
    parts.length !== 6
    || parts[0] !== 'scrypt'
    || Number(parts[1]) !== COST
    || Number(parts[2]) !== BLOCK_SIZE
    || Number(parts[3]) !== PARALLELIZATION
  ) return false;

  const salt = Buffer.from(parts[4], 'base64url');
  const expected = Buffer.from(parts[5], 'base64url');
  if (salt.length !== SALT_LENGTH || expected.length !== KEY_LENGTH) return false;

  const actual = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
  });
  return timingSafeEqual(expected, actual);
}
