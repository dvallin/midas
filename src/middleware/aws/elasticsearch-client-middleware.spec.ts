import { expect, it } from 'vitest'
import { pipeline } from '../../pipeline'
import { elasticSearchClientMiddleware } from './elasticsearch-client-middleware'

it('creates client', async () => {
  const run = pipeline()
    .use(elasticSearchClientMiddleware({}))
    .use((_e, c) => c)
    .build()
  const result = await run({}, {})
  expect(result.aws.elasticSearchServiceClient).toBeDefined()
})
