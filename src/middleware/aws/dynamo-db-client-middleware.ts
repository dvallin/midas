import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { ContextExtensionMiddleware } from '..'

export type DynamoDbContext = {
  aws: { dynamoDb: DynamoDBDocument }
}
export const dynamoDbClientMiddleware = <
  C extends { aws?: Record<string, unknown> },
>(
  config: DynamoDBClientConfig,
): ContextExtensionMiddleware<C, DynamoDbContext> => {
  return async (_e, ctx, next) => {
    const client = new DynamoDBClient(config)
    try {
      if (!ctx.aws) {
        ctx.aws = {}
      }
      ctx.aws.dynamoDb = DynamoDBDocument.from(client)
      return await next(ctx as C & DynamoDbContext)
    } finally {
      client.destroy()
    }
  }
}
