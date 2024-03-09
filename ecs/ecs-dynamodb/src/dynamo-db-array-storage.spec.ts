import {
  componentConfig,
  componentStorageConfig,
  InMemoryComponentStorage,
} from 'ecs-core'
import arrayStorageSpec from 'ecs-core/src/component/array-storage-spec'
import shoppingCartUsecase, {
  CartEventSchema,
} from 'ecs-core/src/use-cases/shopping-cart'
import { afterAll, beforeAll } from 'vitest'
import { string } from '@spaceteams/zap'

import { DynamoDbArrayStorage } from './dynamo-db-array-storage'
import { createTestDynamoDbStorage } from './create-test-dynamo-db-storage'

const { storage } = await createTestDynamoDbStorage('dynamo-db-array-storage', {
  arrayStorageSpec: componentConfig({
    type: 'array',
    schema: string(),
    storageConfig: componentStorageConfig({ type: 'dynamo' }),
  }),
  cartEvents: componentConfig({
    type: 'array',
    schema: CartEventSchema,
    storageConfig: componentStorageConfig({ type: 'dynamo' }),
  }),
})

beforeAll(() => storage.migrate())
afterAll(() => storage.teardown())

arrayStorageSpec(() => new DynamoDbArrayStorage('arrayStorageSpec', storage))
shoppingCartUsecase(() => ({
  carts: new InMemoryComponentStorage(),
  cartEvents: new DynamoDbArrayStorage('cartEvents', storage),
}))
