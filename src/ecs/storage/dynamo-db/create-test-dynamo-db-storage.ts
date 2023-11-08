import {
  contextMixinMiddleware,
  dynamoDbClientMiddleware,
} from '../../../middleware'
import { pipeline } from '../../../pipeline'
import { DynamoDbStorage, DynamoDbStorageContext } from './dynamo-db-storage'

export function createTestDynamoDbStorage(
  components: DynamoDbStorageContext['ecs']['components'],
) {
  return pipeline()
    .use(
      dynamoDbClientMiddleware(
        {
          region: 'us-east-1',
          endpoint: process.env.LOCALSTACK_ENDPOINT,
        },
        { region: 'us-east-1', endpoint: process.env.LOCALSTACK_ENDPOINT },
      ),
    )
    .use(
      contextMixinMiddleware(() => ({
        ecs: {
          storage: {
            dynamodb: {
              config: {},
            },
          },
          components,
        },
      })),
    )
    .use((_e, c) => new DynamoDbStorage(c))
    .run({}, {})
}
