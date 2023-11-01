import { DynamoDbComponentStorage } from './dynamo-db-component-storage'
import { DynamoDbStorage } from './dynamo-db-storage'
import componentStorageSpec from '../component-storage-spec'
import productVariantsUsecase from '../../use-cases/product-variants'
import { pipeline } from '../../../pipeline'
import {
  contextMixinMiddleware,
  dynamoDbClientMiddleware,
} from '../../../middleware'
import { afterEach, beforeEach } from 'vitest'

let storage = await pipeline()
  .use(
    dynamoDbClientMiddleware({
      region: 'us-east-1',
      endpoint: process.env.LOCALSTACK_ENDPOINT,
    }),
  )
  .use(
    contextMixinMiddleware(() => ({
      ecs: {
        storage: {
          dynamodb: {
            config: { tableName: 'component-storage-test-components' },
          },
        },
      },
    })),
  )
  .use((_e, c) => new DynamoDbStorage(c))
  .run({}, {})

beforeEach(() => storage.migrate())
afterEach(() => storage.teardown())

componentStorageSpec(() => new DynamoDbComponentStorage('products', storage))

productVariantsUsecase(() => ({
  skus: new DynamoDbComponentStorage('skus', storage),
  variants: new DynamoDbComponentStorage('variants', storage),
  products: new DynamoDbComponentStorage('products', storage),
  cursors: new DynamoDbComponentStorage('cursors', storage),
}))
