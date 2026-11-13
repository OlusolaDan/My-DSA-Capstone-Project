import { DomainError } from '../domain/errors.js';
import { verifyToken } from '../lib/token.js';

export function requireUser(request, secret) {
  const authorization = request.headers.authorization;
  const match = typeof authorization === 'string' && /^Bearer ([^\s]+)$/i.exec(authorization);
  if (!match) throw new DomainError('UNAUTHENTICATED', 'A valid bearer token is required');
  return verifyToken(match[1], { secret });
}

export function requireRole(user, ...roles) {
  if (!user || !roles.includes(user.role)) {
    throw new DomainError('FORBIDDEN', 'Your account is not allowed to perform this action');
  }
  return user;
}
