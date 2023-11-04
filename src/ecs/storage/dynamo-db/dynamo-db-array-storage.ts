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

  async read(entityId: string): Promise<T[] | undefined> {
    const result = await this.underlying.read(entityId)
    return result?.boxed
  }

  async write(entityId: string, component: T[]): Promise<void> {
    await this.underlying.write(entityId, { boxed: component })
  }

  conditionalWrite(
    entityId: string,
    current: T[],
    previous: T[] | undefined,
  ): Promise<void> {
    return this.underlying.conditionalWrite(
      entityId,
      { boxed: current },
      previous ? { boxed: previous } : undefined,
    )
  }

  all() {
    return this.underlying.all()
  }

  updates(cursor: string) {
    return this.underlying.updates(cursor)
  }

  commitUpdateIndex(): Promise<void> {
    return this.underlying.commitUpdateIndex()
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
