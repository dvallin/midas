import { Client } from '@elastic/elasticsearch'
import {
  BatchWrite,
  ComponentConfig,
  ConditionalWriteError,
  EcsBaseContext,
  InferComponents,
  Time,
  TimeContext,
  ValidationMode,
} from 'ecs-core'
import { ElasticsearchContext } from 'middleware-elasticsearch'
import { ContextExtensionMiddleware } from 'middleware-core'
import {
  MappingProperty,
  QueryDslBoolQuery,
} from '@elastic/elasticsearch/lib/api/types'
import { Schema } from '@spaceteams/zap'

export type ElasticsearchStorageContext<
  Components extends {
    [componentName: string]: ComponentConfig<unknown>
  },
> =
  & ElasticsearchContext
  & EcsBaseContext<Components>
  & TimeContext
  & {
    storage: {
      elastic: {
        config: {
          alwaysRefresh?: boolean
        }
      }
    }
  }
export const elasticsearchStorageContextMiddleware = <
  Components extends {
    [componentName: string]: ComponentConfig<unknown>
  },
  C extends ElasticsearchContext & EcsBaseContext<Components> & TimeContext,
>(
  alwaysRefresh?: boolean,
): ContextExtensionMiddleware<
  C,
  ElasticsearchStorageContext<InferComponents<C>>
> => {
  return async (ctx, next) => {
    const c = ctx as { storage?: Record<string, unknown> }
    if (!c.storage) {
      c.storage = {}
    }
    c.storage.elastic = {
      config: {
        alwaysRefresh,
      },
    }
    return await next(
      ctx as C & ElasticsearchStorageContext<InferComponents<C>>,
    )
  }
}

export class ElasticsearchStorage<
  Components extends {
    [componentName: string]: ComponentConfig<unknown>
  },
> {
  protected readonly client: Client
  protected readonly time: Time
  protected readonly alwaysRefresh: boolean
  protected readonly batchSize: number
  protected readonly components: EcsBaseContext<Components>['components']
  protected readonly defaultValidationMode: ValidationMode
  constructor(
    protected readonly context: ElasticsearchStorageContext<Components>,
  ) {
    this.client = context.elastic.client
    this.time = context.service.time
    this.alwaysRefresh = context.storage.elastic.config.alwaysRefresh ?? false
    this.batchSize = Math.min(context.storage.batchSize ?? 10, 25)
    this.components = context.components
    this.defaultValidationMode = context.storage.validationMode ?? 'all'
  }

  supports(componentName: string) {
    return this.components[componentName].storageConfig.type === 'elastic'
  }

  validationMode(componentName: string) {
    return (
      this.components[componentName].storageConfig.validationMode ??
        this.defaultValidationMode
    )
  }

  getIndex(componentName: string) {
    return `components_${componentName}`.toLocaleLowerCase()
  }

  read<T>(componentName: string, entityId: string) {
    return this.client.get<{ component: T }>({
      id: entityId,
      index: this.getIndex(componentName),
    })
  }

  async batchRead<T>(componentName: string, entityIds: string[]) {
    type Result = Awaited<ReturnType<typeof this.client.mget<{ component: T }>>>
    const docs: Result['docs'] = []

    const ids = [...entityIds]
    while (ids.length) {
      const batch = ids.splice(0, this.batchSize)
      const result = await this.client.mget<{ component: T }>({
        ids: batch,
        index: this.getIndex(componentName),
      })

      docs.push(...result.docs)
    }
    return { docs } as Result
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

  async batchWrite<T>(componentName: string, writes: BatchWrite<T>[]) {
    const operations: Record<string, unknown>[] = []
    const lastModifiedByEntityId: { [entityId: string]: number } = {}

    const ops = [...writes]
    while (ops.length) {
      const batch = ops.splice(0, this.batchSize)

      for (const { entityId, component } of batch) {
        const lastModified = this.time.now
        operations.push({
          index: {
            _index: this.getIndex(componentName),
            _id: entityId,
          },
        })
        lastModifiedByEntityId[entityId] = lastModified
        operations.push({ component, lastModified })
      }
      await this.client.bulk<{
        component: T
        lastModified: number
      }>({
        refresh: this.alwaysRefresh,
        operations,
      })
    }
    return { lastModifiedByEntityId }
  }

  async delete<T>(
    componentName: string,
    entityId: string,
  ): Promise<{ cursor: string }> {
    const lastModified = this.time.now
    await this.client.delete({
      id: entityId,
      index: this.getIndex(componentName),
      refresh: this.alwaysRefresh,
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
      throw new ConditionalWriteError('conditional write failed', e)
    }
    return { cursor: lastModified.toString() }
  }

  updates<T>(componentName: string, lastModified: number) {
    return this.client.search<{
      component: T
      lastModified: number
    }>({
      index: this.getIndex(componentName),
      size: 100,
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

  match<T>(componentName: string, match: Partial<T>) {
    return this.client.search<{ component: T }>({
      index: this.getIndex(componentName),
      query: {
        nested: {
          path: 'component',
          query: {
            bool: {
              must: Object.entries(match).map(([key, value]) => ({
                match: { [`component.${key}`]: value },
              })),
            } as QueryDslBoolQuery,
          },
        },
      },
    })
  }

  prefix<T>(componentName: string, key: keyof T, match: Partial<T>) {
    return this.client.search<{ component: T }>({
      index: this.getIndex(componentName),
      query: {
        nested: {
          path: 'component',
          query: {
            bool: {
              must: Object.entries(match).map(([key, value]) => ({
                prefix: { [`component.${key}`]: value },
              })),
            } as QueryDslBoolQuery,
          },
        },
      },
      aggs: {
        component: {
          nested: { path: 'component' },
          aggs: {
            [key]: {
              terms: {
                field: `component.${key as string}`,
              },
            },
          },
        },
      },
    })
  }

  mappingPropertyFromSchema(schema: Schema<unknown>): MappingProperty {
    const meta = schema.meta()
    switch (meta.type) {
      case 'object': {
        const objectMeta = meta as unknown as {
          type: 'object'
          schema: { [key: string]: Schema<unknown> }
          additionalProperties: boolean | Schema<unknown>
        }
        const properties: Record<string, MappingProperty> = {}
        for (const [key, inner] of Object.entries(objectMeta.schema)) {
          properties[key] = this.mappingPropertyFromSchema(inner)
        }
        return {
          type: 'nested',
          properties,
        }
      }
      default: {
        return {
          type: 'keyword',
        }
      }
    }
  }

  async migrate() {
    for (const componentName of Object.keys(this.context.components)) {
      const schema = this.components[componentName].schema
      await this.client.indices.create({
        index: this.getIndex(componentName),
        mappings: {
          properties: {
            lastModified: { type: 'double' },
            component: schema
              ? this.mappingPropertyFromSchema(schema)
              : { type: 'keyword' },
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
