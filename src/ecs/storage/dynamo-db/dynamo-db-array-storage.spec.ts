import { DynamoDbArrayStorage } from './dynamo-db-array-storage'
import arrayStorageSpec from '../array-storage-spec'
import shoppingCartUsecase from '../../use-cases/shopping-cart'
import { afterAll, beforeAll } from 'vitest'
import { InMemoryComponentStorage } from '../in-memory'
import { createTestDynamoDbStorage } from './create-test-dynamo-db-storage'

const storage = await createTestDynamoDbStorage('array-storage-test-components')

beforeAll(() => storage.migrate())
afterAll(() => storage.teardown())

arrayStorageSpec(() => new DynamoDbArrayStorage('array', storage))
shoppingCartUsecase(() => ({
  carts: new InMemoryComponentStorage(),
  cartEvents: new DynamoDbArrayStorage('cartEvents', storage),
}))
