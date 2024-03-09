import { json, Schema } from '@spaceteams/zap'
import { ArrayStorage, ComponentConfig, ComponentType } from 'ecs-core'

import { AbstractDynamoDbComponentStorage } from './abstract-dynamo-db-component-storage'
import { DynamoDbStorage } from './dynamo-db-storage'
import { parseThrowing, validateThrowing } from '../../../schema-parse'

export class DynamoDbArrayStorage<
  Components extends {
    [componentName: string]: ComponentConfig<unknown>
  },
  K extends keyof Components,
> extends AbstractDynamoDbComponentStorage<
  ComponentType<Components[K]>[],
  string[],
  Components
> implements ArrayStorage<ComponentType<Components[K]>> {
  constructor(componentName: K, storage: DynamoDbStorage<Components>) {
    super(componentName as string, storage)
  }

  encode(value: ComponentType<Components[K]>[] | null): string[] | null {
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

    return value.map((v) => JSON.stringify(v))
  }

  decode(value: string[] | null): ComponentType<Components[K]>[] {
    if (this.storage.validateOnRead(this.componentName)) {
      const schema = this.storage.getSchema(this.componentName)
      if (schema !== undefined) {
        const parser = json(schema as Schema<ComponentType<Components[K]>>)
        return (value ?? []).map((v) => parseThrowing(parser, v))
      }
    }
    return (value ?? []).map((v) => JSON.parse(v))
  }

  async arrayPush(
    entityId: string,
    component: ComponentType<Components[K]>,
  ): Promise<{ cursor: string }> {
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
