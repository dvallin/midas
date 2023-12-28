import { KeyStorage } from '..'
import { ComponentConfig } from '../..'
import { AbstractDynamoDbComponentStorage } from './abstract-dynamo-db-component-storage'
import { DynamoDbStorage } from './dynamo-db-storage'

export class DynamoDbKeyStorage<
  Components extends {
    [componentName: string]: ComponentConfig
  },
> extends AbstractDynamoDbComponentStorage<string, string, Components>
  implements KeyStorage {
  constructor(componentName: string, storage: DynamoDbStorage<Components>) {
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
