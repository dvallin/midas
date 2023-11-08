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

  async write(entityId: string, component: T): Promise<void> {
    await this.storage.write(
      this.componentName,
      entityId,
      this.encode(component),
    )
  }

  async conditionalWrite(
    entityId: string,
    current: T,
    previous: T | undefined,
  ): Promise<void> {
    try {
      await this.storage.conditionalWrite(
        this.componentName,
        entityId,
        this.encode(current),
        previous ? this.encode(previous) : undefined,
      )
    } catch (e) {
      if (e instanceof ConditionalCheckFailedException) {
        throw new Error('conditional write failed', e)
      } else {
        throw e
      }
    }
  }

  async *all() {
    const result = await this.storage.all(this.componentName)
    for (const item of result.Items ?? []) {
      yield {
        entityId: item.entityId,
        component: this.decode(item.component),
      }
    }
  }

  async *updates(cursor: string) {
    const result = await this.storage.updates(this.componentName, cursor)
    for (const item of result.Items ?? []) {
      yield {
        entityId: item.entityId,
        cursor: item.sequenceNumber,
      }
    }
  }

  commitUpdateIndex(): Promise<void> {
    return this.storage.commitUpdateIndex(this.componentName)
  }
}
