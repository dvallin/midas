import { DynamoDbSetStorage } from './dynamo-db-set-storage'
import productCategoriesUsecase from '../../use-cases/product-categories'
import { beforeAll, afterAll } from 'vitest'
import { InMemoryComponentStorage } from '../in-memory'
import { createTestDynamoDbStorage } from './create-test-dynamo-db-storage'
import spec from '../set-storage-spec'

const storage = await createTestDynamoDbStorage('set-storage-test-components')

beforeAll(() => storage.migrate())
afterAll(() => storage.teardown())

spec(() => new DynamoDbSetStorage('test', storage))
productCategoriesUsecase(() => ({
  categories: new InMemoryComponentStorage(),
  productToCategories: new DynamoDbSetStorage('productToCategories', storage),
  categoryToProducts: new DynamoDbSetStorage('categoryToProducts', storage),
}))
