import { afterAll, beforeAll } from 'vitest'
import { createTestDynamoDbStorage } from './create-test-dynamo-db-storage'
import { string } from '@spaceteams/zap'
import scheduleStorageSpec from '../schedule-storage-spec'
import locking, { LockSchema } from '../../use-cases/locking'
import seatPlanning from '../../use-cases/seat-planning'
import { DynamoDbComponentStorage } from './dynamo-db-component-storage'
import { DynamoDbScheduleStorageStorage } from './dynamo-db-schedule-storage'
import { InMemoryComponentStorage } from '../in-memory'
import { DynamoDbSetStorage } from './dynamo-db-set-storage'
import { componentConfig, componentStorageConfig } from '../..'

const { storage } = await createTestDynamoDbStorage(
  'dynamo-db-next-update-storage',
  {
    scheduleStorageSpec: componentConfig({
      type: 'set',
      schema: string(),
      storageConfig: componentStorageConfig({ type: 'dynamo' }),
    }),
    schedules: componentConfig({
      type: 'schedule',
      storageConfig: componentStorageConfig({ type: 'dynamo' }),
    }),
    lockStorage: componentConfig({
      type: 'default',
      schema: LockSchema,
      storageConfig: componentStorageConfig({ type: 'dynamo' }),
    }),
    soldSeatsOverview: componentConfig({
      type: 'set',
      schema: string(),
      storageConfig: componentStorageConfig({ type: 'dynamo' }),
    }),
    reservedSeatOverview: componentConfig({
      type: 'set',
      schema: string(),
      storageConfig: componentStorageConfig({ type: 'dynamo' }),
    }),
  },
)

beforeAll(() => storage.migrate())
afterAll(() => storage.teardown())

scheduleStorageSpec(() => ({
  storage: new DynamoDbComponentStorage('scheduleStorageSpec', storage),
  schedules: new DynamoDbScheduleStorageStorage('schedules', storage),
}))

locking(() => ({
  locks: new DynamoDbComponentStorage('lockStorage', storage),
  lockReleases: new DynamoDbScheduleStorageStorage('schedules', storage),
  cursors: new InMemoryComponentStorage(),
}))

seatPlanning(() => ({
  soldSeatOverview: new DynamoDbSetStorage('soldSeatsOverview', storage),
  reservedSeatOverview: new DynamoDbSetStorage('reservedSeatOverview', storage),
  baskets: new InMemoryComponentStorage(),
  basketReleases: new DynamoDbScheduleStorageStorage('schedules', storage),
  soldSeats: new InMemoryComponentStorage(),
  cursors: new InMemoryComponentStorage(),
}))
