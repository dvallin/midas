import { SetStorage } from '..'
import { DynamoDbStorage } from './dynamo-db-storage'
import { json, Schema } from '@spaceteams/zap'
import { parseThrowing } from './schema-parse'
import { AbstractDynamoDbComponentStorage } from './abstract-dynamo-db-component-storage'
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'

export class DynamoDbSetStorage<T>
  extends AbstractDynamoDbComponentStorage<T[], Set<string>>
  implements SetStorage<T> {
  constructor(componentName: string, storage: DynamoDbStorage) {
    super(componentName, storage)
  }

  encode(value: T[]): Set<string> {
    return new Set(value.map((v) => JSON.stringify(v)))
  }

  decode(value: Set<string> | null): T[] {
    const schema = this.storage.getSchema(this.componentName)
    if (schema === undefined) {
      const result: T[] = []
      for (const v of value ?? []) {
        result.push(JSON.parse(v))
      }
      return result
    }
    const parser = json(schema as Schema<T>)
    const result: T[] = []
    for (const v of value ?? []) {
      result.push(parseThrowing(parser, v))
    }
    return result
  }

  async add(entityId: string, component: T): Promise<{ cursor: string }> {
    const lastModified = await this.storage.add(
      this.componentName,
      entityId,
      JSON.stringify(component),
    )
    return { cursor: lastModified.toString() }
  }

  async conditionalAdd(
    entityId: string,
    component: T,
  ): Promise<{ cursor: string }> {
    try {
      const lastModified = await this.storage.conditionalAdd(
        this.componentName,
        entityId,
        JSON.stringify(component),
      )
      return { cursor: lastModified.toString() }
    } catch (e) {
      if (e instanceof ConditionalCheckFailedException) {
        throw new Error('conditional add failed', e)
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

  async conditionalDelete(
    entityId: string,
    component: T,
  ): Promise<{ cursor: string }> {
    try {
      const lastModified = await this.storage.conditionalDelete(
        this.componentName,
        entityId,
        JSON.stringify(component),
      )
      return { cursor: lastModified.toString() }
    } catch (e) {
      if (e instanceof ConditionalCheckFailedException) {
        throw new Error('conditional delete failed', e)
      } else {
        throw e
      }
    }
  }
}
