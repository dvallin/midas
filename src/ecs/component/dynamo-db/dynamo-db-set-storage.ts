import { SetStorage } from '..'
import { DynamoDbStorage } from './dynamo-db-storage'
import { json, Schema } from '@spaceteams/zap'
import { parseThrowing } from './schema-parse'
import { AbstractDynamoDbComponentStorage } from './abstract-dynamo-db-component-storage'
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { ComponentConfig } from '../..'

export class DynamoDbSetStorage<
  T,
  Components extends {
    [componentName: string]: ComponentConfig
  },
> extends AbstractDynamoDbComponentStorage<T[], Set<string>, Components>
  implements SetStorage<T> {
  constructor(componentName: string, storage: DynamoDbStorage<Components>) {
    super(componentName, storage)
  }

  encode(value: T[] | null): Set<string> | null {
    return value && new Set(value.map((v) => JSON.stringify(v)))
  }

  decode(value: Set<string> | null): T[] | null {
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

  async setAdd(entityId: string, ...values: T[]): Promise<{ cursor: string }> {
    const lastModified = await this.storage.setAdd(
      this.componentName,
      entityId,
      values.map((v) => JSON.stringify(v)),
    )
    return { cursor: lastModified.toString() }
  }

  async conditionalSetAdd(
    entityId: string,
    ...values: T[]
  ): Promise<{ cursor: string }> {
    try {
      const lastModified = await this.storage.conditionalSetAdd(
        this.componentName,
        entityId,
        values.map((v) => JSON.stringify(v)),
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

  async setDelete(
    entityId: string,
    ...values: T[]
  ): Promise<{ cursor: string }> {
    const lastModified = await this.storage.setDelete(
      this.componentName,
      entityId,
      values.map((v) => JSON.stringify(v)),
    )
    return { cursor: lastModified.toString() }
  }

  async conditionalSetDelete(
    entityId: string,
    ...values: T[]
  ): Promise<{ cursor: string }> {
    try {
      const lastModified = await this.storage.conditionalSetDelete(
        this.componentName,
        entityId,
        values.map((v) => JSON.stringify(v)),
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
