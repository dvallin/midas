import {
  BatchReadResult,
  BatchWrite,
  BatchWriteError,
  BatchWriteResult,
  ComponentStorage,
} from '..'
import { ComponentConfig } from '../..'
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

export class ElasticsearchComponentStorage<
  T,
  Components extends {
    [componentName: string]: ComponentConfig<unknown>
  },
> implements ComponentStorage<T> {
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
}
