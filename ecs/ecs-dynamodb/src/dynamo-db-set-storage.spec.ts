import { string } from '@spaceteams/zap'
import { afterAll, beforeAll } from 'vitest'
import {
  componentConfig,
  componentStorageConfig,
  InMemoryComponentStorage,
} from 'ecs-core'
import productCategoriesUsecase from 'ecs-core/src/use-cases/product-categories'
import setStorageSpec from 'ecs-core/src/component/set-storage-spec'

import { DynamoDbSetStorage } from './dynamo-db-set-storage'
import { createTestDynamoDbStorage } from './create-test-dynamo-db-storage'

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
