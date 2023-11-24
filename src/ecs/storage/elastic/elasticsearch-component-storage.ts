import {
  BatchReadResult,
  BatchWrite,
  BatchWriteResult,
  ComponentStorage,
} from '..'
import { ElasticsearchStorage } from './elasticsearch-storage'

export class ElasticsearchComponentStorage<T> implements ComponentStorage<T> {
  constructor(
    protected readonly componentName: string,
    protected readonly storage: ElasticsearchStorage,
  ) {}

  getIndex() {
    return `components_${this.componentName}`.toLocaleLowerCase()
  }

  async read(entityId: string): Promise<T | undefined> {
    const result = await this.storage.read<T>(this.componentName, entityId)
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

  write(entityId: string, component: T): Promise<{ cursor: string }> {
    return this.storage.write(this.componentName, entityId, component)
  }

  conditionalWrite(
    entityId: string,
    current: T,
    previous: T | undefined,
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
          error: new Error(doc.error.reason, { cause: doc.error }),
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
