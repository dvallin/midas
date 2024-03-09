import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { string } from '@spaceteams/zap'
import { componentConfig, componentStorageConfig, MockTime } from 'ecs-core'
import componentStorageSpec from 'ecs-core/src/component/component-storage-spec'
import productVariantsUsecase, {
  ProductSchema,
  SkuSchema,
  VariantSchema,
} from 'ecs-core/src/use-cases/product-variants'

import { DynamoDbComponentStorage } from './dynamo-db-component-storage'
import { DynamoDbUpdateStorage } from './dynamo-db-update-storage'
import { createTestDynamoDbStorage } from './create-test-dynamo-db-storage'

const { storage, context } = await createTestDynamoDbStorage(
  'dynamo-db-component-storage',
  {
    componentStorageTest: componentConfig({
      tracksUpdates: true,
      schema: string(),
      storageConfig: componentStorageConfig({ type: 'dynamo' }),
    }),
    componentStorageSpec: componentConfig({
      tracksUpdates: true,
      schema: string(),
      storageConfig: componentStorageConfig({ type: 'dynamo' }),
    }),
    skus: componentConfig({
      tracksUpdates: true,
      schema: SkuSchema,
      storageConfig: componentStorageConfig({ type: 'dynamo' }),
    }),
    variants: componentConfig({
      tracksUpdates: true,
      schema: VariantSchema,
      storageConfig: componentStorageConfig({ type: 'dynamo' }),
    }),
    products: componentConfig({
      tracksUpdates: true,
      schema: ProductSchema,
      storageConfig: componentStorageConfig({ type: 'dynamo' }),
    }),
    cursors: componentConfig({
      tracksUpdates: true,
      schema: string(),
      storageConfig: componentStorageConfig({ type: 'dynamo' }),
    }),
  },
)

beforeAll(() => storage.migrate())
afterAll(() => storage.teardown())

componentStorageSpec(() => ({
  storage: new DynamoDbComponentStorage('componentStorageSpec', storage),
  updates: new DynamoDbUpdateStorage('componentStorageSpec', storage),
}))

productVariantsUsecase(() => ({
  skus: new DynamoDbComponentStorage('skus', storage),
  skuUpdates: new DynamoDbUpdateStorage('skus', storage),
  variants: new DynamoDbComponentStorage('variants', storage),
  variantUpdates: new DynamoDbUpdateStorage('variants', storage),
  products: new DynamoDbComponentStorage('products', storage),
  cursors: new DynamoDbComponentStorage('cursors', storage),
}))

describe('updates', () => {
  it('works for updates over multiple days', async () => {
    const test = new DynamoDbComponentStorage('componentStorageTest', storage)
    const testUpdates = new DynamoDbUpdateStorage(
      'componentStorageTest',
      storage,
    )
    const time = context.service.time as MockTime

    time.setMockNow(new Date('2023-11-10T19:22:14Z'))
    const { cursor } = await test.write('test-day-1', 'day-1')

    time.setMockNow(new Date('2023-11-12T19:22:14Z'))
    test.write('test-day-2', 'day-2')

    time.setMockNow(new Date('2023-11-13T19:22:14Z'))
    const updates: string[] = []
    for await (const { entityId } of testUpdates.updates(cursor)) {
      updates.push(entityId)
    }

    expect(updates).toEqual(['test-day-2'])

    time.resetMock()
  })
})
