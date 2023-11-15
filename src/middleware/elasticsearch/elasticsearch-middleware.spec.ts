import { expect, it } from 'vitest'
import { pipeline } from '../../pipeline'
import {
  ElasticsearchEndpointContext,
  elasticsearchMiddleware,
} from './elasticsearch-middleware'

it('creates client', async () => {
  const run = pipeline<unknown, ElasticsearchEndpointContext>()
    .use(elasticsearchMiddleware({}))
    .use((_e, c) => c)
    .build()
  const result = await run(
    {},
    { aws: { elasticsearchEndpoint: process.env.ELASTICSEARCH_ENDPOINT! } },
  )
  expect(result.elastic.client).toBeDefined()
})
