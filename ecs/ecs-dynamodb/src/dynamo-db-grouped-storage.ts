import {
  ComponentConfig,
  ComponentEncoder,
  ComponentType,
  GroupedStorage,
} from 'ecs-core'

import { DynamoDbStorage } from './dynamo-db-storage'

export class DynamoDbGroupedStorage<
  Components extends {
    [componentName: string]: ComponentConfig<unknown>
  },
> implements GroupedStorage<Components> {
  private readonly componentNames: (keyof Components)[]

  constructor(
    protected componentEncoders: {
      [componentName in keyof Components]?: ComponentEncoder<unknown, unknown>
    },
    protected storage: DynamoDbStorage<Components>,
  ) {
    this.componentNames = Object.keys(componentEncoders)
    const tables = new Set(
      this.componentNames.map((componentName) =>
        storage.getTableName(componentName)
      ),
    )
    if (tables.size !== 1) {
      throw new Error(
        `components ${this.componentNames.join(',')} are in multiple table ${
          [
            ...tables,
          ].join(',')
        } but must be in a single group`,
      )
    }
  }

  async read(entityId: string): Promise<
    {
      [componentName in keyof Components]?:
        | ComponentType<
          Components[componentName]
        >
        | null
    }
  > {
    const rows = await this.storage.readGroup(this.componentNames, entityId)
    const result: { [key: string]: unknown } = {}
    for (let i = 0; i < this.componentNames.length; i++) {
      const componentName = this.componentNames[i]
      const encoder = this.componentEncoders[componentName] as ComponentEncoder<
        unknown,
        unknown
      >
      const value = rows[componentName]
      result[componentName as string] = encoder.decode(value)
    }
    return result as {
      [componentName in keyof Components]?: ComponentType<
        Components[componentName]
      >
    }
  }

  async write(
    entityId: string,
    components: {
      [componentName in keyof Components]?: ComponentType<
        Components[componentName]
      >
    },
  ): Promise<{ cursor: string }> {
    const writes: { componentName: keyof Components; component: unknown }[] = []
    for (const componentName of Object.keys(components)) {
      const encoder = this.componentEncoders[componentName] as ComponentEncoder<
        unknown,
        unknown
      >
      writes.push({
        componentName,
        component: encoder.encode(components[componentName]),
      })
    }
    const { lastModified, unprocessed } = await this.storage.writeGroup(
      entityId,
      writes,
    )
    if (unprocessed.length > 0) {
      throw new Error(`could not write ${unprocessed.join(',')}`)
    }
    return { cursor: lastModified.toString() }
  }

  async delete(entityId: string): Promise<{ cursor: string }> {
    const writes: { componentName: keyof Components; component: unknown }[] = []
    for (const componentName of this.componentNames) {
      writes.push({
        componentName,
        component: null,
      })
    }
    const { lastModified, unprocessed } = await this.storage.writeGroup(
      entityId,
      writes,
    )
    if (unprocessed.length > 0) {
      throw new Error(`could not write ${unprocessed.join(',')}`)
    }
    return { cursor: lastModified.toString() }
  }
  async erase(entityId: string): Promise<void> {
    const operations: Promise<unknown>[] = []
    for (const componentName of this.componentNames) {
      operations.push(this.storage.delete(componentName, entityId))
    }
    await Promise.all(operations)
  }
}
