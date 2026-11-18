import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mongoose from 'mongoose';

// Must match tests/globalSetup.ts: the shared mongod's URI is written here.
const MONGO_URI_FILE = join(tmpdir(), 'smarturl-test-mongo-uri.txt');

/**
 * Connect Mongoose to this file's own database on the shared in-memory
 * mongod (started once by globalSetup). A database per test file keeps
 * files isolated while sharing one server process.
 */
export async function startTestDb(dbName: string): Promise<void> {
  let baseUri: string;
  try {
    baseUri = (await readFile(MONGO_URI_FILE, 'utf8')).trim();
  } catch {
    throw new Error(
      'Test MongoDB URI file not found — globalSetup did not run. ' +
        'Run tests through `npm test`, not by importing the helpers directly.'
    );
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(`${baseUri.replace(/\/$/, '')}/${dbName}`);
  // Build indexes up front: several tests rely on unique indexes existing
  // (alias races, duplicate registration) rather than on background builds.
  await mongoose.connection.syncIndexes();
}

/** Wipe all documents (indexes stay) so tests within a file stay isolated. */
export async function clearTestDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
}

export async function stopTestDb(): Promise<void> {
  await mongoose.connection.dropDatabase().catch(() => undefined);
  await mongoose.disconnect();
}
