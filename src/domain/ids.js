import { randomBytes, randomUUID } from 'node:crypto';

export function newId() {
  return randomUUID();
}

// Unambiguous characters make codes easier to read aloud and transcribe.
export function newReference() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = '';
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return `ET-${code.slice(0, 4)}-${code.slice(4)}`;
}
