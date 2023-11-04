import { DynamoDbComponentStorage } from './dynamo-db-component-storage'
import componentStorageSpec from '../component-storage-spec'
import productVariantsUsecase from '../../use-cases/product-variants'
import { afterAll, beforeAll } from 'vitest'
import { createTestDynamoDbStorage } from './create-test-dynamo-db-storage'

const storage = await createTestDynamoDbStorage(
  'component-storage-test-components',
)

beforeAll(() => storage.migrate())
afterAll(() => storage.teardown())

componentStorageSpec(() => new DynamoDbComponentStorage('products', storage))

productVariantsUsecase(() => ({
  skus: new DynamoDbComponentStorage('skus', storage),
  variants: new DynamoDbComponentStorage('variants', storage),
  products: new DynamoDbComponentStorage('products', storage),
  cursors: new DynamoDbComponentStorage('cursors', storage),
}))
