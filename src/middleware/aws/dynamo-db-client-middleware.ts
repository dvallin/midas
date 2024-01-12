import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { ContextExtensionMiddleware } from '..'
import { lens, mutate } from '../mutable-context'

export type DynamoDbContext = {
  aws: { dynamoDb: DynamoDBDocument }
}
export const dynamoDbClientMiddleware = <C>(
  config: DynamoDBClientConfig,
): ContextExtensionMiddleware<C, DynamoDbContext> => {
  return async (_e, ctx, next) => {
    const client = new DynamoDBClient(config)
    try {
      const nextContext = lens(
        ctx,
        'aws',
        (aws) => mutate(aws, 'dynamoDb', DynamoDBDocument.from(client)),
      )
      return await next(nextContext)
    } finally {
      client.destroy()
    }
  }
}
