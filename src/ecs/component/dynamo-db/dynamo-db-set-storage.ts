import { SetStorage } from '../set-storage'
import { DynamoDbStorage } from './dynamo-db-storage'
import { json, Schema } from '@spaceteams/zap'
import { parseThrowing, validateThrowing } from './schema-parse'
import { AbstractDynamoDbComponentStorage } from './abstract-dynamo-db-component-storage'
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { ComponentConfig, ComponentType } from '../..'
import { ConditionalWriteError } from '../component-storage'

export class DynamoDbSetStorage<
  Components extends {
    [componentName: string]: ComponentConfig<unknown>
  },
  K extends keyof Components,
> extends AbstractDynamoDbComponentStorage<
  ComponentType<Components[K]>[],
  Set<string>,
  Components
> implements SetStorage<ComponentType<Components[K]>> {
  constructor(componentName: K, storage: DynamoDbStorage<Components>) {
    super(componentName, storage)
  }

  encode(value: ComponentType<Components[K]>[] | null): Set<string> | null {
    if (value === null) {
      return null
    }

    const validateOnWrite = this.storage.validateOnWrite(this.componentName)
    if (validateOnWrite) {
      const schema = this.storage.getSchema(this.componentName)
      if (schema) {
        for (const v of value) {
          validateThrowing(schema, v)
        }
      }
    }

    return new Set(value.map((v) => JSON.stringify(v)))
  }

  decode(value: Set<string> | null): ComponentType<Components[K]>[] | null {
    if (this.storage.validateOnRead(this.componentName)) {
      const schema = this.storage.getSchema(this.componentName)
      if (schema !== undefined) {
        const parser = json(schema as Schema<ComponentType<Components[K]>>)
        const result: ComponentType<Components[K]>[] = []
        for (const v of value ?? []) {
          result.push(parseThrowing(parser, v))
        }
        return result
      }
    }
    const result: ComponentType<Components[K]>[] = []
    for (const v of value ?? []) {
      result.push(JSON.parse(v))
    }
    return result
  }

  async setAdd(
    entityId: string,
    ...values: ComponentType<Components[K]>[]
  ): Promise<{ cursor: string }> {
    const lastModified = await this.storage.setAdd(
      this.componentName,
      entityId,
      values.map((v) => JSON.stringify(v)),
    )
    return { cursor: lastModified.toString() }
  }

  async conditionalSetAdd(
    entityId: string,
    ...values: ComponentType<Components[K]>[]
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
        throw new ConditionalWriteError('conditional add failed', e)
      } else {
        throw e
      }
    }
  }

  async setDelete(
    entityId: string,
    ...values: ComponentType<Components[K]>[]
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
    ...values: ComponentType<Components[K]>[]
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
        throw new ConditionalWriteError('conditional delete failed', e)
      } else {
        throw e
      }
    }
  }
}
