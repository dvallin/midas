import { Client } from '@elastic/elasticsearch'
import { Time, TimeContext } from '../../service/time'
import { ElasticsearchContext } from '../../../middleware/elasticsearch/elasticsearch-middleware'
import { EcsBaseContext } from '../..'
import { ContextExtensionMiddleware } from '../../../middleware'

export type ElasticsearchStorageContext = ElasticsearchContext &
  EcsBaseContext &
  TimeContext & {
    storage: {
      elastic: {
        config: {
          alwaysRefresh?: boolean
        }
      }
    }
  }
export const elasticsearchStorageContextMiddleware = <
  C extends ElasticsearchContext & EcsBaseContext & TimeContext,
>(
  alwaysRefresh?: boolean,
): ContextExtensionMiddleware<C, ElasticsearchStorageContext> => {
  return async (_e, ctx, next) => {
    const c = ctx as { storage?: Record<string, unknown> }
    if (!c.storage) {
      c.storage = {}
    }
    c.storage.elastic = {
      config: {
        alwaysRefresh,
      },
    }
    return await next(ctx as C & ElasticsearchStorageContext)
  }
}

export class ElasticsearchStorage {
  protected readonly client: Client
  protected readonly time: Time
  protected readonly alwaysRefresh: boolean
  constructor(protected readonly context: ElasticsearchStorageContext) {
    this.client = context.elastic.client
    this.time = context.service.time
    this.alwaysRefresh = context.storage.elastic.config.alwaysRefresh ?? false
  }

  getIndex(componentName: string) {
    return `components_${componentName}`.toLocaleLowerCase()
  }

  async read<T>(componentName: string, entityId: string) {
    return this.client.get<{ component: T }>({
      id: entityId,
      index: this.getIndex(componentName),
    })
  }

  async write<T>(
    componentName: string,
    entityId: string,
    component: T,
  ): Promise<{ cursor: string }> {
    const lastModified = this.time.now
    await this.client.update({
      id: entityId,
      index: this.getIndex(componentName),
      refresh: this.alwaysRefresh,
      doc: { component, lastModified },
      upsert: { component, lastModified },
    })
    return { cursor: lastModified.toString() }
  }

  async conditionalWrite<T>(
    componentName: string,
    entityId: string,
    current: T,
    previous: T | undefined,
  ): Promise<{ cursor: string }> {
    const lastModified = this.time.now
    const script = `
    if (ctx._source.component == params.previous) {
      ctx._source.component = params.current;
      ctx._source.lastModified = params.lastModified;
    } else {
      throw new IllegalArgumentException("conditional write failed");
    }
  `
    try {
      await this.client.update({
        id: entityId,
        index: this.getIndex(componentName),
        refresh: this.alwaysRefresh,
        body: {
          script: {
            source: script,
            lang: 'painless',
            params: {
              current,
              previous,
              lastModified,
            },
          },
        },
        upsert: { component: current, lastModified },
      })
    } catch (e) {
      throw new Error('conditional write failed')
    }
    return { cursor: lastModified.toString() }
  }

  updates<T>(componentName: string, lastModified: number) {
    return this.client.search<{
      component: T
      lastModified: number
    }>({
      index: this.getIndex(componentName),
      query: {
        range: {
          lastModified: {
            gt: lastModified,
          },
        },
      },
      sort: ['lastModified'],
    })
  }

  async migrate() {
    for (const componentName of Object.keys(this.context.components)) {
      await this.client.indices.create({
        index: this.getIndex(componentName),
        mappings: {
          properties: {
            lastModified: { type: 'double' },
            // TODO: infer from type and schema
            component: { type: 'keyword' },
          },
        },
      })
    }
  }
  async teardown() {
    for (const componentName of Object.keys(this.context.components)) {
      await this.client.indices.delete({ index: this.getIndex(componentName) })
    }
  }
}
