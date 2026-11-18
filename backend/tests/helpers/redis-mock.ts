import RedisMock from 'ioredis-mock';

// One in-memory Redis shared by the tests in a file. Test files that need
// Redis mock `../src/config/redis` with mockRedisModule() (see redirect.test.ts)
// and flush this instance between tests.
export const mockRedis = new RedisMock();

/** Module shape of src/config/redis, backed by the in-memory mock. */
export function mockRedisModule() {
  return {
    redisClient: () => mockRedis,
    isRedisEnabled: () => true,
    connectRedis: async () => {},
    disconnectRedis: async () => {},
  };
}
