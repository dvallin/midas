import { ElasticsearchComponentStorage } from './elasticsearch-component-storage'
import { ElasticsearchUpdateStorage } from './elasticsearch-update-storage'
import componentStorageSpec from '../component-storage-spec'
import { pipeline } from '../../../pipeline'
import { timeMiddleware } from '../../service/time'
import {
  elasticsearchEndpointMiddleware,
  elasticsearchMiddleware,
} from '../../../middleware/elasticsearch/elasticsearch-middleware'
import { afterAll, beforeAll } from 'vitest'
import {
  ElasticsearchStorage,
  elasticsearchStorageContextMiddleware,
} from './elasticsearch-storage'
import {
  componentConfig,
  componentStorageConfig,
  ecsBaseMiddleware,
} from '../..'
import { string } from '@spaceteams/zap'

const storage = await pipeline()
  .use(
    ecsBaseMiddleware('cluster', {
      componentStorageSpec: componentConfig({
        type: 'default',
        tracksUpdates: true,
        schema: string(),
        storageConfig: componentStorageConfig({ type: 'elastic' }),
      }),
    }),
  )
  .use(timeMiddleware())
  .use(elasticsearchEndpointMiddleware(process.env.ELASTICSEARCH_ENDPOINT!))
  .use(elasticsearchMiddleware({}))
  .use(elasticsearchStorageContextMiddleware(true))
  .use((_e, c) => new ElasticsearchStorage(c))
  .run({}, {})

beforeAll(() => storage.migrate())
afterAll(() => storage.teardown())

componentStorageSpec(() => ({
  storage: new ElasticsearchComponentStorage('componentStorageSpec', storage),
  updates: new ElasticsearchUpdateStorage('componentStorageSpec', storage),
}))
