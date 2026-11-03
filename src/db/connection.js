import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));
const defaultDatabasePath = fileURLToPath(new URL('../../data/ticketing.sqlite', import.meta.url));

export function createConnection(databasePath = process.env.DATABASE_PATH ?? defaultDatabasePath) {
  if (databasePath !== ':memory:') mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });

  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA foreign_keys = ON');
  database.exec(readFileSync(schemaPath, 'utf8'));
  return database;
}
