const TOKEN_KEY = 'gather.authToken';

export function getToken() {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(TOKEN_KEY);
}

export function saveToken(token) {
  if (typeof token !== 'string' || token.length === 0) throw new TypeError('A session token is required');
  if (typeof sessionStorage === 'undefined') throw new Error('Session storage is unavailable');
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(TOKEN_KEY);
}
