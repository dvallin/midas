import {
  contextMixinMiddleware,
  dynamoDbClientMiddleware,
} from '../../../middleware'
import { pipeline } from '../../../pipeline'
import { DynamoDbStorage } from './dynamo-db-storage'

export function createTestDynamoDbStorage(tableName: string) {
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
              config: { tableName },
            },
          },
        },
      })),
    )
    .use((_e, c) => new DynamoDbStorage(c))
    .run({}, {})
}
