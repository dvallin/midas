import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { SetStorage } from '..'
import { DynamoDbComponentStorage } from './dynamo-db-component-storage'
import { DynamoDbStorage } from './dynamo-db-storage'

export class DynamoDbSetStorage<T> implements SetStorage<T> {
  private readonly underlying: DynamoDbComponentStorage<{ boxed?: Set<T> }>
  constructor(
    protected componentName: string,
    protected storage: DynamoDbStorage,
  ) {
    this.underlying = new DynamoDbComponentStorage(componentName, storage)
  }

  async read(entityId: string): Promise<T[] | undefined> {
    const result = await this.underlying.read(entityId)
    return result ? Array.from(result.boxed ?? []) : undefined
  }

  async write(entityId: string, component: T[]): Promise<void> {
    await this.underlying.write(entityId, { boxed: new Set(component) })
  }

  conditionalWrite(
    entityId: string,
    current: T[],
    previous: T[] | undefined,
  ): Promise<void> {
    return this.underlying.conditionalWrite(
      entityId,
      { boxed: new Set(current) },
      previous ? { boxed: new Set(previous) } : undefined,
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

  async add(entityId: string, component: T): Promise<void> {
    try {
      await this.storage.add(this.componentName, entityId, component)
    } catch (e) {
      if (e instanceof ConditionalCheckFailedException) {
        return this.write(entityId, [component])
      }
    }
  }
  async delete(entityId: string, component: T): Promise<void> {
    await this.storage.delete(this.componentName, entityId, component)
  }
}
