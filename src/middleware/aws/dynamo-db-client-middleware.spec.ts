import { expect, it } from 'vitest'
import { pipeline } from '../../pipeline'
import { dynamoDbClientMiddleware } from './dynamo-db-client-middleware'

it('creates client', async () => {
  const run = pipeline()
    .use(dynamoDbClientMiddleware({}))
    .use((_e, c) => c)
    .build()
  const result = await run({}, {})
  expect(result.aws.dynamoDb).toBeDefined()
})
