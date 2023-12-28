import { DynamoDbArrayStorage } from './dynamo-db-array-storage'
import arrayStorageSpec from '../array-storage-spec'
import shoppingCartUsecase, {
  CartEventSchema,
} from '../../use-cases/shopping-cart'
import { afterAll, beforeAll } from 'vitest'
import { InMemoryComponentStorage } from '../in-memory'
import { createTestDynamoDbStorage } from './create-test-dynamo-db-storage'
import { string } from '@spaceteams/zap'
import { componentConfig, componentStorageConfig } from '../..'

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
