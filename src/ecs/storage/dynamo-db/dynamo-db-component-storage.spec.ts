import { DynamoDbComponentStorage } from './dynamo-db-component-storage'
import componentStorageSpec from '../component-storage-spec'
import productVariantsUsecase, {
  ProductSchema,
  SkuSchema,
  VariantSchema,
} from '../../use-cases/product-variants'
import { afterAll, beforeAll } from 'vitest'
import { createTestDynamoDbStorage } from './create-test-dynamo-db-storage'
import { string } from '@spaceteams/zap'

const storage = await createTestDynamoDbStorage({
  componentStorageSpec: {
    type: 'default',
    tracksUpdates: true,
    schema: string(),
  },
  skus: { type: 'default', tracksUpdates: true, schema: SkuSchema },
  variants: { type: 'default', tracksUpdates: true, schema: VariantSchema },
  products: { type: 'default', tracksUpdates: false, schema: ProductSchema },
  cursors: { type: 'default', tracksUpdates: false, schema: string() },
})

beforeAll(() => storage.migrate())
afterAll(() => storage.teardown())

componentStorageSpec(
  () => new DynamoDbComponentStorage('componentStorageSpec', storage),
)

productVariantsUsecase(() => ({
  skus: new DynamoDbComponentStorage('skus', storage),
  variants: new DynamoDbComponentStorage('variants', storage),
  products: new DynamoDbComponentStorage('products', storage),
  cursors: new DynamoDbComponentStorage('cursors', storage),
}))
