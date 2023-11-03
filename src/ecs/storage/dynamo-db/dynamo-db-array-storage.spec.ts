import { DynamoDbArrayStorage } from './dynamo-db-array-storage'
import arrayStorageSpec from '../array-storage-spec'
import shoppingCartUsecase from '../../use-cases/shopping-cart'
import { afterEach, beforeEach } from 'vitest'
import { InMemoryComponentStorage } from '../in-memory'
import { createTestDynamoDbStorage } from './create-test-dynamo-db-storage'

const storage = await createTestDynamoDbStorage('array-storage-test-components')

beforeEach(() => storage.migrate())
afterEach(() => storage.teardown())

arrayStorageSpec(() => new DynamoDbArrayStorage('array', storage))
shoppingCartUsecase(() => ({
  carts: new InMemoryComponentStorage(),
  cartEvents: new DynamoDbArrayStorage('cartEvents', storage),
}))
