import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { ArrayStorage } from '..'
import { AbstractDynamoDbComponentStorage } from './abstract-dynamo-db-component-storage'
import { DynamoDbStorage } from './dynamo-db-storage'
import { json, Schema } from '@spaceteams/zap'
import { parseThrowing } from './schema-parse'

export class DynamoDbArrayStorage<T>
  extends AbstractDynamoDbComponentStorage<T[], { boxed: string[] }>
  implements ArrayStorage<T> {
  constructor(componentName: string, storage: DynamoDbStorage) {
    super(componentName, storage)
  }

  encode(value: T[]): { boxed: string[] } {
    return { boxed: value.map((v) => JSON.stringify(v)) }
  }

  decode(value: { boxed: string[] }): T[] {
    const schema = this.storage.getSchema(this.componentName)
    if (schema === undefined) {
      return value.boxed.map((v) => JSON.parse(v))
    }
    const parser = json(schema as Schema<T>)
    return value.boxed.map((v) => parseThrowing(parser, v))
  }

  async push(entityId: string, component: T): Promise<{ cursor: string }> {
    try {
      const lastModified = await this.storage.push(
        this.componentName,
        entityId,
        JSON.stringify(component),
      )
      return { cursor: lastModified.toString() }
    } catch (e) {
      if (e instanceof ConditionalCheckFailedException) {
        return this.write(entityId, [component])
      } else {
        throw e
      }
    }
  }
}
