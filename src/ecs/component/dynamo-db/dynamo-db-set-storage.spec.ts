import { DynamoDbSetStorage } from './dynamo-db-set-storage'
import productCategoriesUsecase from '../../use-cases/product-categories'
import { afterAll, beforeAll } from 'vitest'
import { InMemoryComponentStorage } from '../in-memory'
import { createTestDynamoDbStorage } from './create-test-dynamo-db-storage'
import setStorageSpec from '../set-storage-spec'
import { string } from '@spaceteams/zap'
import { componentConfig, componentStorageConfig } from '../..'

const { storage } = await createTestDynamoDbStorage('dynamo-db-set-storage', {
  setStorageSpec: componentConfig({
    type: 'set',
    schema: string(),
    storageConfig: componentStorageConfig({ type: 'dynamo' }),
  }),
  productToCategories: componentConfig({
    type: 'set',
    schema: string(),
    storageConfig: componentStorageConfig({ type: 'dynamo' }),
  }),
  categoryToProducts: componentConfig({
    type: 'set',
    schema: string(),
    storageConfig: componentStorageConfig({ type: 'dynamo' }),
  }),
})

beforeAll(() => storage.migrate())
afterAll(() => storage.teardown())

setStorageSpec(() => new DynamoDbSetStorage('setStorageSpec', storage))
productCategoriesUsecase(() => ({
  categories: new InMemoryComponentStorage(),
  productToCategories: new DynamoDbSetStorage('productToCategories', storage),
  categoryToProducts: new DynamoDbSetStorage('categoryToProducts', storage),
}))
