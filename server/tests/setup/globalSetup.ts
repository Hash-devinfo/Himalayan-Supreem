import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

// A throwaway MongoDB that lives only while the tests run. It is a one-member replica set,
// because orders, stock and refunds use transactions (exactly like Atlas).
// Your real database (MONGO_URI in .env) is never touched.
let replSet: MongoMemoryReplSet | undefined;

export async function setup(project: TestProject) {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  project.provide('mongoUri', replSet.getUri());
}

export async function teardown() {
  await replSet?.stop();
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}