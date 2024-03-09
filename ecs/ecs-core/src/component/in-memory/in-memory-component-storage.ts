import {
  BatchReadResult,
  BatchWrite,
  BatchWriteResult,
  ComponentStorage,
} from '../component-storage'
import { Time } from '../../service/time'

export class InMemoryComponentStorage<T> implements ComponentStorage<T> {
  protected readonly storage: Record<
    string,
    { component: T | null; lastModified: number }
  > = {}

  protected readonly time = new Time()

  public get data() {
    return this.storage
  }

  public get size() {
    return Object.keys(this.storage).length
  }

  read(entityId: string): Promise<T | undefined | null> {
    return Promise.resolve(this.storage[entityId]?.component)
  }
  async readOrThrow(entityId: string): Promise<T> {
    const result = await this.read(entityId)
    if (!result) {
      throw new Error(`could not find component for entity ${entityId}`)
    }
    return result
  }

  write(entityId: string, component: T): Promise<{ cursor: string }> {
    const lastModified = this.time.now
    this.storage[entityId] = { component, lastModified }
    return Promise.resolve({ cursor: lastModified.toString() })
  }

  conditionalWrite(
    entityId: string,
    current: T,
    previous: T | undefined | null,
  ): Promise<{ cursor: string }> {
    const value = this.storage[entityId]
    if (JSON.stringify(value?.component) !== JSON.stringify(previous)) {
      return Promise.reject(new Error('conditional write failed'))
    }
    return this.write(entityId, current)
  }

  delete(entityId: string): Promise<{ cursor: string }> {
    const lastModified = this.time.now
    this.storage[entityId] = { component: null, lastModified }
    return Promise.resolve({ cursor: lastModified.toString() })
  }
  erase(entityId: string): Promise<void> {
    delete this.storage[entityId]
    return Promise.resolve()
  }

  batchRead(entityIds: string[]): Promise<BatchReadResult<T>> {
    const result: BatchReadResult<T> = {}
    for (const id of entityIds) {
      result[id] = {
        value: this.storage[id]?.component,
      }
    }
    return Promise.resolve(result)
  }

  batchWrite(writes: BatchWrite<T>[]): Promise<BatchWriteResult> {
    const result: BatchWriteResult = {}

    for (const { entityId, component } of writes) {
      const lastModified = this.time.now
      result[entityId] = {
        cursor: lastModified?.toString(),
      }
      this.storage[entityId] = { component, lastModified }
    }

    return Promise.resolve(result)
  }
}
