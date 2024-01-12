import { DynamoDbStorage } from './dynamo-db-storage'
import { json, Schema } from '@spaceteams/zap'
import { parseThrowing, validateThrowing } from './schema-parse'
import { AbstractDynamoDbComponentStorage } from './abstract-dynamo-db-component-storage'
import { ComponentStorage } from '../component-storage'
import { ComponentConfig, ComponentType } from '../..'

export class DynamoDbComponentStorage<
  Components extends {
    [componentName: string]: ComponentConfig<unknown>
  },
  K extends keyof Components,
> extends AbstractDynamoDbComponentStorage<
  ComponentType<Components[K]>,
  string,
  Components
> implements ComponentStorage<ComponentType<Components[K]>> {
  constructor(componentName: K, storage: DynamoDbStorage<Components>) {
    super(componentName, storage)
  }

  encode(value: ComponentType<Components[K]> | null): string | null {
    if (value === null) {
      return null
    }

    const validateOnWrite = this.storage.validateOnWrite(this.componentName)
    if (validateOnWrite) {
      const schema = this.storage.getSchema(this.componentName)
      if (schema) {
        validateThrowing(schema, value)
      }
    }

    return JSON.stringify(value)
  }

  decode(value: string | null): ComponentType<Components[K]> | null {
    if (value === null) {
      return null
    }
    if (this.storage.validateOnRead(this.componentName)) {
      const schema = this.storage.getSchema(this.componentName)
      if (schema !== undefined) {
        const parser = json(schema as Schema<ComponentType<Components[K]>>)
        return parseThrowing(parser, value)
      }
    }
    return JSON.parse(value)
  }
}
