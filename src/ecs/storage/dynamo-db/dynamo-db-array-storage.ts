import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { ArrayStorage } from '..'
import { DynamoDbComponentStorage } from './dynamo-db-component-storage'
import { DynamoDbStorage } from './dynamo-db-storage'

export class DynamoDbArrayStorage<T> implements ArrayStorage<T> {
  private readonly underlying: DynamoDbComponentStorage<{ boxed: T[] }>
  constructor(
    protected componentName: string,
    protected storage: DynamoDbStorage,
  ) {
    this.underlying = new DynamoDbComponentStorage(componentName, storage)
  }

  async read(entity: string): Promise<T[] | undefined> {
    const result = await this.underlying.read(entity)
    return result?.boxed
  }

  async write(entity: string, component: T[]): Promise<void> {
    await this.underlying.write(entity, { boxed: component })
  }

  conditionalWrite(
    entity: string,
    current: T[],
    previous: T[] | undefined,
  ): Promise<void> {
    return this.underlying.conditionalWrite(
      entity,
      { boxed: current },
      previous ? { boxed: previous } : undefined,
    )
  }

  updates(startDate: Date) {
    return this.underlying.updates(startDate)
  }

  async push(entityId: string, component: T): Promise<void> {
    try {
      await this.storage.push(this.componentName, entityId, component)
    } catch (e) {
      if (e instanceof ConditionalCheckFailedException) {
        return this.write(entityId, [component])
      }
    }
  }
}
