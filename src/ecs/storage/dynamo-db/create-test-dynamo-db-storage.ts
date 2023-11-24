import { EcsBaseContext, ecsBaseMiddleware } from '../..'
import { dynamoDbClientMiddleware } from '../../../middleware'
import { pipeline } from '../../../pipeline'
import { MockTime, timeMiddleware } from '../../service/time'
import {
  DynamoDbStorage,
  dynamoDbStorageContextMiddleware,
} from './dynamo-db-storage'

export function createTestDynamoDbStorage(
  clusterId: string,
  components: EcsBaseContext['components'],
) {
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
    .use((_e, c) => ({
      context: c,
      storage: new DynamoDbStorage(c),
    }))
    .run({}, {})
}
