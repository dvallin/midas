import { expect, it } from 'vitest'
import { pipeline } from 'middleware-core'
import {
  ElasticsearchEndpointContext,
  elasticsearchMiddleware,
} from './elasticsearch-middleware'

it('creates client', async () => {
  const run = pipeline<ElasticsearchEndpointContext>()
    .use(elasticsearchMiddleware({}))
    .build()
  const result = await run(
    { elastic: { endpoint: process.env.ELASTICSEARCH_ENDPOINT ?? '' } },
  )
  expect(result.elastic.client).toBeDefined()
})
