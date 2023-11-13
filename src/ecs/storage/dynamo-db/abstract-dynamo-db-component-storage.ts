import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { ComponentStorage } from '..'
import { DynamoDbStorage } from './dynamo-db-storage'

export abstract class AbstractDynamoDbComponentStorage<T, E>
  implements ComponentStorage<T>
{
  constructor(
    protected componentName: string,
    protected storage: DynamoDbStorage,
  ) {}

  abstract encode(value: T): E
  abstract decode(value: E): T

  async read(entityId: string): Promise<T | undefined> {
    const result = (await this.storage.read(this.componentName, entityId)) as E
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

  async *updates(
    cursor?: string,
  ): AsyncGenerator<{ entityId: string; cursor: string }> {
    if (cursor) {
      const lastModified = parseFloat(cursor)
      const result = await this.storage.updates(
        this.componentName,
        lastModified,
      )
      for (const item of result.Items ?? []) {
        yield {
          entityId: item.entityId,
          cursor: item.lastModified,
        }
      }
      for (const startDate of this.storage.datesAfter(lastModified)) {
        const result = await this.storage.updates(
          this.componentName,
          startDate.valueOf(),
        )
        for (const item of result.Items ?? []) {
          yield {
            entityId: item.entityId,
            cursor: item.lastModified,
          }
        }
      }
    } else {
      const result = await this.storage.all(this.componentName)
      for (const item of result.Items ?? []) {
        yield {
          entityId: item.entityId,
          cursor: item.lastModified,
        }
      }
    }
  }
}
