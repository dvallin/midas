import { DynamoDbArrayStorage } from './dynamo-db-array-storage'
import arrayStorageSpec from '../array-storage-spec'
import shoppingCartUsecase from '../../use-cases/shopping-cart'
import { pipeline } from '../../../pipeline'
import {
  contextMixinMiddleware,
  dynamoDbClientMiddleware,
} from '../../../middleware'
import { afterEach, beforeEach } from 'vitest'
import { InMemoryComponentStorage } from '../in-memory'
import { DynamoDbStorage } from './dynamo-db-storage'

const storage = await pipeline()
  .use(
    dynamoDbClientMiddleware({
      region: 'us-east-1',
      endpoint: process.env.LOCALSTACK_ENDPOINT,
    }),
  )
  .use(
    contextMixinMiddleware((c) => ({
      ecs: {
        storage: {
          dynamodb: {
            config: { tableName: 'array-storage-test-components' },
          },
        },
      },
    })),
  )
  .use((_e, c) => new DynamoDbStorage(c))
  .run({}, {})

beforeEach(() => storage.migrate())
afterEach(() => storage.teardown())

arrayStorageSpec(() => new DynamoDbArrayStorage('array', storage))
shoppingCartUsecase(() => ({
  carts: new InMemoryComponentStorage(),
  cartEvents: new DynamoDbArrayStorage('cartEvents', storage),
}))
