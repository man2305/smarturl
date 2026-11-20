import { MongoMemoryServer } from 'mongodb-memory-server';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// One in-memory mongod for the whole suite: per-file servers crashed
// under parallel startup (mongod invariant failure), and one server with
// a database per test file gives the same isolation for far less RAM/CPU.
// The URI is passed to workers through this file (globalSetup and the
// test workers are different processes, so module state cannot be shared).
export const MONGO_URI_FILE = join(tmpdir(), 'smarturl-test-mongo-uri.txt');

let mongod: MongoMemoryServer | null = null;

export async function setup(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  await writeFile(MONGO_URI_FILE, mongod.getUri(), 'utf8');
}

export async function teardown(): Promise<void> {
  await mongod?.stop();
  await unlink(MONGO_URI_FILE).catch(() => undefined);
}
