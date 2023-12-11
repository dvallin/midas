import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import {
  BatchReadResult,
  BatchWrite,
  BatchWriteResult,
  ComponentStorage,
} from '..'
import { DynamoDbStorage } from './dynamo-db-storage'

export abstract class AbstractDynamoDbComponentStorage<T, E>
  implements ComponentStorage<T> {
  constructor(
    protected componentName: string,
    protected storage: DynamoDbStorage,
  ) {}

  abstract encode(value: T): E
  abstract decode(value: E | null): T

  async read(entityId: string): Promise<T | undefined> {
    const result = await this.storage.read<E>(this.componentName, entityId)
    if (result === undefined) {
      return undefined
    }
    return this.decode(result)
  }

  async readOrThrow(entityId: string): Promise<T> {
    const result = await this.read(entityId)
    if (!result) {
      throw new Error(
        `could not find component ${this.componentName} for entity ${entityId}`,
      )
    }
    return result
  }

  async write(entityId: string, component: T): Promise<{ cursor: string }> {
    const lastModified = await this.storage.write(
      this.componentName,
      entityId,
      this.encode(component),
    )
    return { cursor: lastModified.toString() }
  }

  async conditionalWrite(
    entityId: string,
    current: T,
    previous: T | undefined,
  ): Promise<{ cursor: string }> {
    try {
      const lastModified = await this.storage.conditionalWrite(
        this.componentName,
        entityId,
        this.encode(current),
        previous ? this.encode(previous) : undefined,
      )
      return { cursor: lastModified.toString() }
    } catch (e) {
      if (e instanceof ConditionalCheckFailedException) {
        throw new Error('conditional write failed', e)
      } else {
        throw e
      }
    }
  }

  async batchRead(entityIds: string[]): Promise<BatchReadResult<T>> {
    const result: BatchReadResult<T> = {}
    const batchReadResult = await this.storage.batchRead<E>(
      this.componentName,
      entityIds,
    )
    for (const id of entityIds) {
      const value = batchReadResult.components[id]
      result[id] = { value: value ? this.decode(value) : undefined }
    }
    for (const id of batchReadResult.unprocessed) {
      result[id] = { error: new Error('not processed') }
    }
    return result
  }

  async batchWrite(writes: BatchWrite<T>[]): Promise<BatchWriteResult> {
    const result: BatchWriteResult = {}
    const batchReadResult = await this.storage.batchWrite(
      this.componentName,
      writes.map(({ entityId, component }) => ({
        entityId,
        component: this.encode(component),
      })),
    )
    for (const { entityId } of writes) {
      const lastModified = batchReadResult.lastModifiedByEntityId[entityId]
      result[entityId] = { cursor: lastModified.toString() }
    }
    for (const entityId of batchReadResult.unprocessed) {
      result[entityId].error = new Error('not processed')
    }
    return result
  }
}
