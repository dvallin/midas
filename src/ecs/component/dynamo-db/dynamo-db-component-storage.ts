import { ComponentStorage } from '..'
import { DynamoDbStorage } from './dynamo-db-storage'
import { json, Schema } from '@spaceteams/zap'
import { parseThrowing, validateThrowing } from './schema-parse'
import { AbstractDynamoDbComponentStorage } from './abstract-dynamo-db-component-storage'
import { ComponentConfig } from '../..'

export class DynamoDbComponentStorage<
  T,
  Components extends {
    [componentName: string]: ComponentConfig
  },
> extends AbstractDynamoDbComponentStorage<T, string, Components>
  implements ComponentStorage<T> {
  constructor(componentName: string, storage: DynamoDbStorage<Components>) {
    super(componentName, storage)
  }

  encode(value: T | null): string | null {
    const validationMode = this.storage.validationMode(this.componentName)
    if (validationMode === 'write' || validationMode === 'readWrite') {
      const schema = this.storage.getSchema(this.componentName)
      schema && validateThrowing(schema, value)
    }
    return value && JSON.stringify(value)
  }

  decode(value: string | null): T | null {
    if (value === null) {
      return null
    }
    const validationMode = this.storage.validationMode(this.componentName)
    if (validationMode === 'read' || validationMode === 'readWrite') {
      const schema = this.storage.getSchema(this.componentName)
      if (schema !== undefined) {
        const parser = json(schema as Schema<T>)
        return parseThrowing(parser, value)
      }
    }
    return JSON.parse(value)
  }
}
