import {
  BatchReadResult,
  BatchWrite,
  BatchWriteError,
  BatchWriteResult,
  ComponentConfig,
  SearchStorage,
} from 'ecs-core'
import { ElasticsearchStorage } from './elasticsearch-storage'

type ResponseError = {
  name: 'ResponseError'
  meta: {
    body: { _index: string; _type: string; _id: string; found: boolean }
    statusCode: number
  }
}

function isResponseError(e: unknown): e is ResponseError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'name' in e &&
    e.name === 'ResponseError'
  )
}

export class ElasticsearchSearchStorage<
  T,
  Components extends {
    [componentName: string]: ComponentConfig<unknown>
  },
> implements SearchStorage<T> {
  constructor(
    protected readonly componentName: string,
    protected readonly storage: ElasticsearchStorage<Components>,
  ) {
    if (!storage.supports(componentName)) {
      throw new Error(`${componentName} does not support elastic search`)
    }
  }

  getIndex() {
    return `components_${this.componentName}`.toLocaleLowerCase()
  }

  async read(entityId: string): Promise<T | undefined | null> {
    try {
      const result = await this.storage.read<T>(this.componentName, entityId)
      return result._source?.component
    } catch (e) {
      if (isResponseError(e) && !e.meta.body.found) {
        return undefined
      }
      throw e
    }
  }

  async readOrThrow(entityId: string): Promise<T> {
    const value = await this.read(entityId)
    if (!value) {
      throw new Error(
        `could not find component ${this.componentName} for entity ${entityId}`,
      )
    }
    return value
  }

  write(entityId: string, component: T): Promise<{ cursor: string }> {
    return this.storage.write(this.componentName, entityId, component)
  }

  delete(entityId: string): Promise<{ cursor: string }> {
    return this.storage.write(this.componentName, entityId, null)
  }

  async erase(entityId: string): Promise<void> {
    await this.storage.delete(this.componentName, entityId)
  }

  conditionalWrite(
    entityId: string,
    current: T,
    previous: T | undefined | null,
  ): Promise<{ cursor: string }> {
    return this.storage.conditionalWrite(
      this.componentName,
      entityId,
      current,
      previous,
    )
  }

  async batchRead(entityIds: string[]): Promise<BatchReadResult<T>> {
    const result: BatchReadResult<T> = {}
    const batchReadResult = await this.storage.batchRead<T>(
      this.componentName,
      entityIds,
    )
    for (const doc of batchReadResult.docs) {
      if ('error' in doc) {
        result[doc._id] = {
          error: new BatchWriteError(doc.error.reason ?? '', doc.error),
        }
      } else {
        result[doc._id] = {
          value: doc._source?.component,
        }
      }
    }
    return result
  }

  async batchWrite(writes: BatchWrite<T>[]): Promise<BatchWriteResult> {
    const result: BatchWriteResult = {}
    const batchWriteResult = await this.storage.batchWrite<T>(
      this.componentName,
      writes,
    )
    for (const { entityId } of writes) {
      const lastModified = batchWriteResult.lastModifiedByEntityId[entityId]
      result[entityId] = { cursor: lastModified.toString() }
    }
    return result
  }

  async match(
    value: Partial<T>,
  ): Promise<{ entityId: string; component: T }[]> {
    const response = await this.storage.match(this.componentName, value)

    const result: { entityId: string; component: T }[] = []
    for (const hit of response.hits.hits) {
      const entityId = hit._id
      const component = hit._source?.component
      if (!component) {
        throw new Error('component missing')
      }
      result.push({ entityId, component })
    }
    return result
  }

  async suggest(key: keyof T, match: Partial<T>): Promise<string[]> {
    const response = await this.storage.prefix(this.componentName, key, match)

    console.log(response.aggregations?.component)
    const result: string[] = []
    const aggregations = response.aggregations?.component as Record<
      string,
      { buckets: { key: string; doc_count: number }[] }
    >
    for (const hit of aggregations[key as string].buckets) {
      result.push(hit.key)
    }
    return result
  }
}
