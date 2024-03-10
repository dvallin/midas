import { expect, it } from 'vitest'
import { pipeline } from 'middleware-core'
import { dynamoDbClientMiddleware } from './dynamo-db-client-middleware'

it('creates client', async () => {
  const run = pipeline()
    .use(dynamoDbClientMiddleware({}))
    .build()
  const result = await run({})
  expect(result.aws.dynamoDb).toBeDefined()
})
