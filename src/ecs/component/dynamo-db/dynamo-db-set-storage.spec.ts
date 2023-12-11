import { DynamoDbSetStorage } from './dynamo-db-set-storage'
import productCategoriesUsecase from '../../use-cases/product-categories'
import { afterAll, beforeAll } from 'vitest'
import { InMemoryComponentStorage } from '../in-memory'
import { createTestDynamoDbStorage } from './create-test-dynamo-db-storage'
import setStorageSpec from '../set-storage-spec'
import { string } from '@spaceteams/zap'

const { storage } = await createTestDynamoDbStorage('dynamo-db-set-storage', {
  setStorageSpec: { type: 'set', tracksUpdates: false, schema: string() },
  productToCategories: { type: 'set', tracksUpdates: false, schema: string() },
  categoryToProducts: { type: 'set', tracksUpdates: false, schema: string() },
})

beforeAll(() => storage.migrate())
afterAll(() => storage.teardown())

setStorageSpec(() => new DynamoDbSetStorage('setStorageSpec', storage))
productCategoriesUsecase(() => ({
  categories: new InMemoryComponentStorage(),
  productToCategories: new DynamoDbSetStorage('productToCategories', storage),
  categoryToProducts: new DynamoDbSetStorage('categoryToProducts', storage),
}))
