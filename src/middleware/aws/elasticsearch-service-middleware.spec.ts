import { expect, it } from 'vitest'
import { pipeline } from '../../pipeline'
import { elasticsearchServiceMiddleware } from './elasticsearch-service-middleware'

it('creates client', async () => {
  const run = pipeline()
    .use(elasticsearchServiceMiddleware({}))
    .use((_e, c) => c)
    .build()
  const result = await run({}, {})
  expect(result.aws.elasticsearchServiceClient).toBeDefined()
})
