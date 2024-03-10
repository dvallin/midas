import { ElasticsearchSearchStorage } from './elasticsearch-search-storage'
import { ElasticsearchUpdateStorage } from './elasticsearch-update-storage'
import componentStorageSpec from 'ecs-core/src/component/component-storage-spec'
import { pipeline } from 'middleware-core'
import {
  elasticsearchEndpointMiddleware,
  elasticsearchMiddleware,
} from 'middleware-elasticsearch'
import { afterAll, beforeAll } from 'vitest'
import {
  ElasticsearchStorage,
  elasticsearchStorageContextMiddleware,
} from './elasticsearch-storage'
import {
  componentConfig,
  componentStorageConfig,
  ecsBaseMiddleware,
  timeMiddleware,
} from 'ecs-core'
import { string } from '@spaceteams/zap'
import dataEntrySpec, { ProductSchema } from 'ecs-core/src/use-cases/data-entry'

const storage = await pipeline()
  .use(
    ecsBaseMiddleware('cluster', {
      componentStorageSpec: componentConfig({
        type: 'default',
        tracksUpdates: true,
        schema: string(),
        storageConfig: componentStorageConfig({ type: 'elastic' }),
      }),
      dataEntrySpec: componentConfig({
        type: 'default',
        tracksUpdates: false,
        schema: ProductSchema,
        storageConfig: componentStorageConfig({ type: 'elastic' }),
      }),
    }),
  )
  .use(timeMiddleware())
  .use(
    elasticsearchEndpointMiddleware(process.env.ELASTICSEARCH_ENDPOINT ?? ''),
  )
  .use(elasticsearchMiddleware({}))
  .use(elasticsearchStorageContextMiddleware(true))
  .use((c) => new ElasticsearchStorage(c))
  .run({})

beforeAll(() => storage.migrate())
afterAll(() => storage.teardown())

componentStorageSpec(() => ({
  storage: new ElasticsearchSearchStorage('componentStorageSpec', storage),
  updates: new ElasticsearchUpdateStorage('componentStorageSpec', storage),
}))

dataEntrySpec(() => ({
  dataset: new ElasticsearchSearchStorage('dataEntrySpec', storage),
}))
