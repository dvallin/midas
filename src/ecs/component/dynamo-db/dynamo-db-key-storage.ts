import { KeyStorage } from '..'
import { AbstractDynamoDbComponentStorage } from './abstract-dynamo-db-component-storage'
import { DynamoDbStorage } from './dynamo-db-storage'

export class DynamoDbKeyStorage
  extends AbstractDynamoDbComponentStorage<string, string>
  implements KeyStorage {
  constructor(componentName: string, storage: DynamoDbStorage) {
    super(componentName, storage)
  }

  encode(value: string): string {
    return value
  }

  decode(value: string | null): string {
    return value ?? ''
  }

  getByKey(key: string): Promise<string | undefined> {
    return this.storage.getByKey(this.componentName, key)
  }

  async getByKeyOrThrow(key: string): Promise<string> {
    const entityId = await this.storage.getByKey(this.componentName, key)
    if (entityId === undefined) {
      throw new Error(
        `could not find entity by key ${key} in component ${this.componentName}`,
      )
    }
    return entityId
  }
}
