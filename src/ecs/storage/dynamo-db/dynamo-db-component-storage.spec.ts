import { DynamoDbComponentStorage } from './dynamo-db-component-storage'
import { DynamoDbUpdateStorage } from './dynamo-db-update-storage'
import componentStorageSpec from '../component-storage-spec'
import productVariantsUsecase, {
  ProductSchema,
  SkuSchema,
  VariantSchema,
} from '../../use-cases/product-variants'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createTestDynamoDbStorage } from './create-test-dynamo-db-storage'
import { string } from '@spaceteams/zap'
import { MockTime } from '../../service/time'

const { storage, context } = await createTestDynamoDbStorage(
  'dynamo-db-component-storage',
  {
    componentStorageTest: {
      type: 'default',
      tracksUpdates: true,
      schema: string(),
    },
    componentStorageSpec: {
      type: 'default',
      tracksUpdates: true,
      schema: string(),
    },
    skus: { type: 'default', tracksUpdates: true, schema: SkuSchema },
    variants: { type: 'default', tracksUpdates: true, schema: VariantSchema },
    products: { type: 'default', tracksUpdates: false, schema: ProductSchema },
    cursors: { type: 'default', tracksUpdates: false, schema: string() },
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
    const test = new DynamoDbComponentStorage<string>(
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
    for await (const { entityId } of test.updates(cursor)) {
      updates.push(entityId)
    }

    expect(updates).toEqual(['test-day-2'])

    time.resetMock()
  })
})
