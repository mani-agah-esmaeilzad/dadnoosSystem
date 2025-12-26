import Redis from 'ioredis'

import { env } from '@/lib/env'

const globalForRedis = globalThis as unknown as {
  redis?: Redis
}

export const redis =
  globalForRedis.redis ||
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis
}

export default redis
