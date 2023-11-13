import { ElasticsearchComponentStorage } from './elasticsearch-component-storage'
import componentStorageSpec from '../component-storage-spec'
import { pipeline } from '../../../pipeline'
import { elasticSearchClientMiddleware } from '../../../middleware/aws/elasticsearch-client-middleware'

const c = pipeline()
  .use(
    elasticSearchClientMiddleware({
      region: 'us-east-1',
      endpoint: process.env.LOCALSTACK_ENDPOINT,
    }),
  )
  .use((_e, c) => c)
  .run({}, {})

componentStorageSpec(
  () => new ElasticsearchComponentStorage('componentStorageSpec', c),
)
