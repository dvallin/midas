import { ComponentConfig, ecsBaseMiddleware } from 'ecs-core'
import { dynamoDbClientMiddleware } from 'middleware-aws'
import { pipeline } from 'middleware-core'
import { MockTime, timeMiddleware } from 'ecs-core'

import {
  DynamoDbStorage,
  dynamoDbStorageContextMiddleware,
} from './dynamo-db-storage'

export function createTestDynamoDbStorage<
  Components extends {
    [componentName: string]: ComponentConfig<unknown>
  },
>(clusterId: string, components: Components) {
  return pipeline()
    .use(
      dynamoDbClientMiddleware({
        region: 'us-east-1',
        endpoint: process.env.LOCALSTACK_ENDPOINT,
      }),
    )
    .use(ecsBaseMiddleware(clusterId, components))
    .use(timeMiddleware(new MockTime()))
    .use(dynamoDbStorageContextMiddleware('TOTAL'))
    .use((c) => ({
      context: c,
      storage: new DynamoDbStorage(c),
    }))
    .run({})
}
