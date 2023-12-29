import { QueryCommandOutput } from '@aws-sdk/lib-dynamodb'
import {
  BatchReadResult,
  BatchWrite,
  BatchWriteResult,
  ConditionalWriteError,
  ScheduleStorage,
} from '..'
import { DynamoDbStorage } from './dynamo-db-storage'
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { ComponentConfig } from '../..'

export class DynamoDbScheduleStorageStorage<
  Components extends {
    [componentName: string]: ComponentConfig
  },
> implements ScheduleStorage
{
  constructor(
    protected componentName: string,
    protected storage: DynamoDbStorage<Components>,
  ) {
    if (!storage.supports(componentName)) {
      throw new Error(`${componentName} does not support dynamo db`)
    }
  }

  decode(value: number | null): Date | null {
    if (value === null) {
      return null
    }
    return new Date(value)
  }

  async read(entityId: string): Promise<Date | null | undefined> {
    const result = await this.storage.readSchedule(this.componentName, entityId)
    if (result === undefined) {
      return undefined
    }
    return this.decode(result)
  }

  async readOrThrow(entityId: string): Promise<Date> {
    const result = await this.read(entityId)
    if (!result) {
      throw new Error(
        `could not find component ${this.componentName} for entity ${entityId}`,
      )
    }
    return result
  }

  async batchRead(entityIds: string[]): Promise<BatchReadResult<Date>> {
    const result: BatchReadResult<Date> = {}
    const batchReadResult = await this.storage.batchReadSchedule(
      this.componentName,
      entityIds,
    )
    for (const id of entityIds) {
      const value = batchReadResult.schedules[id]
      result[id] = {
        value: value !== undefined ? this.decode(value) : undefined,
      }
    }
    for (const id of batchReadResult.unprocessed) {
      result[id] = { error: new Error('not processed') }
    }
    return result
  }

  async write(entityId: string, date: Date): Promise<{ cursor: string }> {
    const lastModified = await this.storage.writeSchedule(
      this.componentName,
      entityId,
      date,
    )
    return { cursor: lastModified.toString() }
  }

  async conditionalWrite(
    entityId: string,
    current: Date,
    previous: Date | null | undefined,
  ): Promise<{ cursor: string }> {
    try {
      const lastModified = await this.storage.conditionalWriteSchedule(
        this.componentName,
        entityId,
        current,
        previous ? previous : undefined,
      )
      return { cursor: lastModified.toString() }
    } catch (e) {
      if (e instanceof ConditionalCheckFailedException) {
        throw new ConditionalWriteError('conditional write failed', e)
      } else {
        throw e
      }
    }
  }

  async readBeforeWriteUpdate(
    entityId: string,
    updater: (previous: Date | null | undefined) => Date,
  ): Promise<{ cursor: string }> {
    const previous = await this.read(entityId)
    return this.conditionalWrite(entityId, updater(previous), previous)
  }

  async batchWrite(writes: BatchWrite<Date>[]): Promise<BatchWriteResult> {
    const result: BatchWriteResult = {}
    const batchReadResult = await this.storage.batchWriteSchedules(
      this.componentName,
      writes.map(({ entityId, component }) => ({
        entityId,
        component,
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

  async delete(entityId: string): Promise<{ cursor: string }> {
    const lastModified = await this.storage.deleteSchedule(
      this.componentName,
      entityId,
    )
    return { cursor: lastModified.toString() }
  }

  async erase(entityId: string): Promise<void> {
    await this.storage.delete(this.componentName, entityId)
  }

  async *updates(
    cursor?: string,
  ): AsyncGenerator<{ entityId: string; cursor: string }> {
    yield* this.schedules(cursor ? new Date(cursor) : undefined)
  }

  async *schedules(
    startDate?: Date,
  ): AsyncGenerator<{ entityId: string; cursor: string }> {
    if (startDate) {
      for (const cursor of this.storage.cursorsOf(startDate.valueOf())) {
        yield* this.updatesOfDate(cursor)
      }
    } else {
      yield* this.allUpdates()
    }
  }

  private async *updatesOfDate(lastModified: number) {
    let cursor = undefined
    do {
      const result = await this.storage.schedules(
        this.componentName,
        lastModified,
        cursor,
      )
      yield* this.yieldItems(result)
      cursor = result.LastEvaluatedKey
    } while (cursor)
  }

  private async *allUpdates() {
    let cursor = undefined
    do {
      const result = await this.storage.allSchedules(this.componentName, cursor)
      yield* this.yieldItems(result)
      cursor = result.LastEvaluatedKey
    } while (cursor)
  }

  private *yieldItems(result: QueryCommandOutput) {
    for (const item of result.Items ?? []) {
      yield {
        entityId: item.entityId,
        cursor: item.lastModified,
      }
    }
  }
}
