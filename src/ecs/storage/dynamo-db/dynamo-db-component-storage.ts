import { ComponentStorage } from '..'
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { DynamoDbStorage } from './dynamo-db-storage'

export class DynamoDbComponentStorage<T> implements ComponentStorage<T> {
  constructor(
    protected componentName: string,
    protected storage: DynamoDbStorage,
  ) {}

  read(entityId: string): Promise<T | undefined> {
    return this.storage.read(this.componentName, entityId)
  }

  async write(entityId: string, component: T): Promise<void> {
    await this.storage.write(this.componentName, entityId, component)
  }

  async conditionalWrite(
    entityId: string,
    current: T,
    previous: T | undefined = undefined,
  ): Promise<void> {
    try {
      return await this.storage.conditionalWrite(
        this.componentName,
        entityId,
        current,
        previous,
      )
    } catch (e) {
      if (e instanceof ConditionalCheckFailedException) {
        throw new Error('conditional write failed', e)
      }
    }
  }

  async *all() {
    const result = await this.storage.all(this.componentName)
    for (const item of result.Items ?? []) {
      yield {
        entityId: item.entityId,
        component: item.component,
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
    return this.storage.commitUpdateIndex()
  }
}
