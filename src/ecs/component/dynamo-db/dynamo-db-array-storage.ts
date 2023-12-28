import { ArrayStorage } from '..'
import { AbstractDynamoDbComponentStorage } from './abstract-dynamo-db-component-storage'
import { DynamoDbStorage } from './dynamo-db-storage'
import { json, Schema } from '@spaceteams/zap'
import { parseThrowing } from './schema-parse'
import { ComponentConfig } from '../..'

export class DynamoDbArrayStorage<
  T,
  Components extends {
    [componentName: string]: ComponentConfig
  },
> extends AbstractDynamoDbComponentStorage<T[], string[], Components>
  implements ArrayStorage<T> {
  constructor(componentName: string, storage: DynamoDbStorage<Components>) {
    super(componentName, storage)
  }

  encode(value: T[]): string[] {
    return value.map((v) => JSON.stringify(v))
  }

  decode(value: string[] | null): T[] {
    const schema = this.storage.getSchema(this.componentName)
    if (schema === undefined) {
      return (value ?? []).map((v) => JSON.parse(v))
    }
    const parser = json(schema as Schema<T>)
    return (value ?? []).map((v) => parseThrowing(parser, v))
  }

  async arrayPush(entityId: string, component: T): Promise<{ cursor: string }> {
    const lastModified = await this.storage.arrayPush(
      this.componentName,
      entityId,
      JSON.stringify(component),
    )
    return { cursor: lastModified.toString() }
  }

  async arrayRemove(
    entityId: string,
    index: number,
  ): Promise<{ cursor: string }> {
    const lastModified = await this.storage.arrayRemove(
      this.componentName,
      entityId,
      index,
    )
    return { cursor: lastModified.toString() }
  }
}
