import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { ContextExtensionMiddleware } from '..'
import {
  DynamoDBStreams,
  DynamoDBStreamsClientConfig,
} from '@aws-sdk/client-dynamodb-streams'

export type DynamoDbContext = {
  aws: { dynamoDb: DynamoDBDocument; dynamoStreams: DynamoDBStreams }
}
export const dynamoDbClientMiddleware = <
  C extends { aws?: Record<string, unknown> },
>(
  config: DynamoDBClientConfig,
  streamsConfig: DynamoDBStreamsClientConfig,
): ContextExtensionMiddleware<C, DynamoDbContext> => {
  return async (_e, ctx, next) => {
    const client = new DynamoDBClient(config)
    try {
      if (!ctx.aws) {
        ctx.aws = {}
      }
      ctx.aws.dynamoDb = DynamoDBDocument.from(client)
      ctx.aws.dynamoStreams = new DynamoDBStreams(streamsConfig)
      return await next(ctx as C & DynamoDbContext)
    } finally {
      client.destroy()
    }
  }
}
