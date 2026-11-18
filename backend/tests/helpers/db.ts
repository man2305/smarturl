import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | null = null;

/** Boot an isolated in-memory MongoDB and connect Mongoose to it. */
export async function startTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongod.getUri());
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
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}
