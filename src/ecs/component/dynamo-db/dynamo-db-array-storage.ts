import { ArrayStorage } from '..'
import { AbstractDynamoDbComponentStorage } from './abstract-dynamo-db-component-storage'
import { DynamoDbStorage } from './dynamo-db-storage'
import { json, Schema } from '@spaceteams/zap'
import { parseThrowing } from './schema-parse'

export class DynamoDbArrayStorage<T>
  extends AbstractDynamoDbComponentStorage<T[], string[]>
  implements ArrayStorage<T> {
  constructor(componentName: string, storage: DynamoDbStorage) {
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

  async push(entityId: string, component: T): Promise<{ cursor: string }> {
    const lastModified = await this.storage.push(
      this.componentName,
      entityId,
      JSON.stringify(component),
    )
    return { cursor: lastModified.toString() }
  }

  async remove(entityId: string, index: number): Promise<{ cursor: string }> {
    const lastModified = await this.storage.remove(
      this.componentName,
      entityId,
      index,
    )
    return { cursor: lastModified.toString() }
  }
}
