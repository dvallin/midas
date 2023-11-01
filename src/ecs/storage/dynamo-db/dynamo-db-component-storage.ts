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

  async *updates(startDate: Date) {
    const result = await this.storage.updates(this.componentName, startDate)
    for (const item of result.Items ?? []) {
      yield {
        entityId: item.entityId,
        lastModified: new Date(item.lastModified),
      }
    }
  }
}
