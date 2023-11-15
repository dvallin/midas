import { Client } from '@elastic/elasticsearch'
import { ComponentStorage } from '..'
import { Time, TimeContext } from '../../service/time'
import { ElasticsearchContext } from '../../../middleware/elasticsearch/elasticsearch-middleware'
import { MappingProperty } from '@elastic/elasticsearch/lib/api/types'

export class ElasticsearchComponentStorage<T> implements ComponentStorage<T> {
  protected readonly client: Client
  protected readonly time: Time
  constructor(
    protected readonly componentName: string,
    protected readonly context: ElasticsearchContext & TimeContext,
    protected readonly alwaysRefresh: boolean,
    protected readonly componentType: MappingProperty,
  ) {
    this.client = context.elastic.client
    this.time = context.service.time
  }

  getIndex() {
    return `components_${this.componentName}`.toLocaleLowerCase()
  }

  async read(entityId: string): Promise<T | undefined> {
    const result = await this.client.get<{ component: T }>({
      id: entityId,
      index: this.getIndex(),
    })
    return result._source?.component
  }

  async readOrThrow(entityId: string): Promise<T> {
    const value = await this.read(entityId)
    if (value === undefined) {
      throw new Error(
        `could not find component ${this.componentName} for entity ${entityId}`,
      )
    }
    return value
  }

  async write(entityId: string, component: T): Promise<{ cursor: string }> {
    const lastModified = this.time.now
    await this.client.update({
      id: entityId,
      index: this.getIndex(),
      refresh: this.alwaysRefresh,
      doc: { component, lastModified },
      upsert: { component, lastModified },
    })
    return { cursor: lastModified.toString() }
  }

  async conditionalWrite(
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
        index: this.getIndex(),
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

  async *updates(
    cursor?: string,
  ): AsyncGenerator<{ entityId: string; cursor: string }, any, unknown> {
    const result = await this.client.search<{
      component: T
      lastModified: number
    }>({
      index: this.getIndex(),
      query: {
        range: {
          lastModified: {
            gt: parseFloat(cursor ?? '0'),
          },
        },
      },
      sort: ['lastModified'],
    })

    for (const hit of result.hits.hits) {
      const entityId = hit._id
      const lastModified = hit._source?.lastModified
      if (!lastModified) {
        throw new Error('last modified missing')
      }
      yield { entityId, cursor: lastModified.toString() }
    }
  }

  async migrate() {
    await this.client.indices.create({
      index: this.getIndex(),
      mappings: {
        properties: {
          lastModified: { type: 'double' },
          component: this.componentType,
        },
      },
    })
  }
  async teardown() {
    await this.client.indices.delete({ index: this.getIndex() })
  }
}
