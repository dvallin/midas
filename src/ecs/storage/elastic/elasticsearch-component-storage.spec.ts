import { ElasticsearchComponentStorage } from './elasticsearch-component-storage'
import componentStorageSpec from '../component-storage-spec'
import { pipeline } from '../../../pipeline'
import { timeMiddleware } from '../../service/time'
import {
  elasticsearchEndpointMiddleware,
  elasticsearchMiddleware,
} from '../../../middleware/elasticsearch/elasticsearch-middleware'
import { afterAll, beforeAll } from 'vitest'

const c = await pipeline()
  .use(timeMiddleware())
  .use(elasticsearchEndpointMiddleware(process.env.ELASTICSEARCH_ENDPOINT!))
  .use(elasticsearchMiddleware({}))
  .use((_e, c) => c)
  .run({}, {})

const storage = new ElasticsearchComponentStorage<string>(
  'componentStorageSpec',
  c,
  true,
  { type: 'keyword' },
)

beforeAll(() => storage.migrate())
afterAll(() => storage.teardown())

componentStorageSpec(() => storage)
