import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { SetStorage } from '..'
import { DynamoDbStorage } from './dynamo-db-storage'
import { json, Schema } from '@spaceteams/zap'
import { parseThrowing } from './schema-parse'
import { AbstractDynamoDbComponentStorage } from './abstract-dynamo-db-component-storage'

export class DynamoDbSetStorage<T>
  extends AbstractDynamoDbComponentStorage<T[], { boxed: Set<string> }>
  implements SetStorage<T> {
  constructor(componentName: string, storage: DynamoDbStorage) {
    super(componentName, storage)
  }

  encode(value: T[]): { boxed: Set<string> } {
    return { boxed: new Set(value.map((v) => JSON.stringify(v))) }
  }

  decode(value: { boxed?: Set<string> }): T[] {
    const schema = this.storage.getSchema(this.componentName)
    if (schema === undefined) {
      const result: T[] = []
      for (const v of value.boxed ?? []) {
        result.push(JSON.parse(v))
      }
      return result
    }
    const parser = json(schema as Schema<T>)
    const result: T[] = []
    for (const v of value.boxed ?? []) {
      result.push(parseThrowing(parser, v))
    }
    return result
  }

  async add(entityId: string, component: T): Promise<{ cursor: string }> {
    try {
      const lastModified = await this.storage.add(
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

  async delete(entityId: string, component: T): Promise<{ cursor: string }> {
    const lastModified = await this.storage.delete(
      this.componentName,
      entityId,
      JSON.stringify(component),
    )
    return { cursor: lastModified.toString() }
  }
}
