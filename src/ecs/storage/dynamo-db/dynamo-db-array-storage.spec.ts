import { DynamoDbArrayStorage } from './dynamo-db-array-storage'
import arrayStorageSpec from '../array-storage-spec'
import shoppingCartUsecase, {
  CartEventSchema,
} from '../../use-cases/shopping-cart'
import { afterAll, beforeAll } from 'vitest'
import { InMemoryComponentStorage } from '../in-memory'
import { createTestDynamoDbStorage } from './create-test-dynamo-db-storage'
import { string } from '@spaceteams/zap'

const { storage } = await createTestDynamoDbStorage('dynamo-db-array-storage', {
  arrayStorageSpec: { type: 'array', tracksUpdates: false, schema: string() },
  cartEvents: { type: 'array', tracksUpdates: false, schema: CartEventSchema },
})

beforeAll(() => storage.migrate())
afterAll(() => storage.teardown())

arrayStorageSpec(() => new DynamoDbArrayStorage('arrayStorageSpec', storage))
shoppingCartUsecase(() => ({
  carts: new InMemoryComponentStorage(),
  cartEvents: new DynamoDbArrayStorage('cartEvents', storage),
}))
