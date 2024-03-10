import { expect, it } from 'vitest'
import { pipeline } from 'middleware-core'
import { elasticsearchServiceMiddleware } from './elasticsearch-service-middleware'

it('creates client', async () => {
  const run = pipeline()
    .use(elasticsearchServiceMiddleware({}))
    .build()
  const result = await run({})
  expect(result.aws.elasticsearchServiceClient).toBeDefined()
})
