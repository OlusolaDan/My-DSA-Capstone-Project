import { randomBytes } from 'node:crypto';
import { DomainError } from '../domain/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signToken } from '../lib/token.js';

const ROLES = new Set(['attendee', 'organizer', 'staff']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_CREDENTIALS = 'Email or password is incorrect';

function publicUser(user) {
  return { id: user.id, email: user.email, role: user.role };
}

function normalizeEmail(email) {
  if (typeof email !== 'string') throw new DomainError('VALIDATION', 'email must be a valid email address');
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
    throw new DomainError('VALIDATION', 'email must be a valid email address');
  }
  return normalized;
}

function validEmail(value) {
  return typeof value === 'string'
    && value.trim().length <= 254
    && EMAIL_PATTERN.test(value.trim().toLowerCase());
}

export function createAuthService(repository, { tokenSecret = process.env.AUTH_TOKEN_SECRET } = {}) {
  if (typeof tokenSecret !== 'string' || Buffer.byteLength(tokenSecret) < 32) {
    throw new Error('AUTH_TOKEN_SECRET must contain at least 32 bytes');
  }
  const dummyHash = hashPassword(randomBytes(32).toString('base64url'));

  return {
    async signup({ email, password, role = 'attendee' } = {}) {
      const normalizedEmail = normalizeEmail(email);
      if (typeof password !== 'string' || password.length < 8 || password.length > 1024) {
        throw new DomainError('VALIDATION', 'password must contain between 8 and 1024 characters');
      }
      if (!ROLES.has(role)) throw new DomainError('VALIDATION', 'role must be attendee, organizer or staff');
      const user = await repository.createUser({
        id: randomBytes(16).toString('hex'),
        email: normalizedEmail,
        passwordHash: await hashPassword(password),
        role,
      });
      return { user: publicUser(user), token: signToken({ sub: user.id, role: user.role }, { secret: tokenSecret }) };
    },

    async login({ email, password } = {}) {
      const normalizedEmail = validEmail(email) ? email.trim().toLowerCase() : '';
      const user = normalizedEmail ? await repository.getUserByEmail(normalizedEmail) : null;
      const storedHash = user?.passwordHash ?? await dummyHash;
      const passwordMatches = await verifyPassword(typeof password === 'string' ? password : '\0', storedHash);
      if (!user || !passwordMatches) {
        throw new DomainError('INVALID_CREDENTIALS', INVALID_CREDENTIALS);
      }
      return { user: publicUser(user), token: signToken({ sub: user.id, role: user.role }, { secret: tokenSecret }) };
    },

    async getCurrentUser(id) {
      const user = await repository.getUserById(id);
      if (!user) throw new DomainError('UNAUTHENTICATED', 'A valid bearer token is required');
      return publicUser(user);
    },
  };
}
