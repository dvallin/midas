import { ComponentStorage } from '..'
import { DynamoDbStorage } from './dynamo-db-storage'
import { json, Schema } from '@spaceteams/zap'
import { parseThrowing } from './schema-parse'
import { AbstractDynamoDbComponentStorage } from './abstract-dynamo-db-component-storage'

export class DynamoDbComponentStorage<T>
  extends AbstractDynamoDbComponentStorage<T, string>
  implements ComponentStorage<T> {
  constructor(componentName: string, storage: DynamoDbStorage) {
    super(componentName, storage)
  }

  encode(value: T): string {
    return JSON.stringify(value)
  }

  decode(value: string): T {
    const schema = this.storage.getSchema(this.componentName)
    if (schema === undefined) {
      return JSON.parse(value)
    }
    const parser = json(schema as Schema<T>)
    return parseThrowing(parser, value)
  }
}
