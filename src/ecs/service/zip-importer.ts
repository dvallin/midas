import { ComponentStorage } from '../storage'
import { Schema } from '@spaceteams/zap'

export class ZipImporter {
  constructor(
    private readonly cursors: ComponentStorage<number>,
    private readonly maxClockSkewMs = 1000,
  ) {}

  async runImport<T>(
    importName: string,
    storages: { [componentName: string]: ComponentStorage<unknown> },
    schema: Schema<T>,
    onEntity: (entityId: string, components: T) => Promise<void>,
  ) {
    const startDate = (await this.cursors.read(importName)) ?? -8640000000000000
    const endDate = this.now() - this.maxClockSkewMs

    let nextCursor = startDate
    const seen = new Set()
    for (const componentName of Object.keys(storages)) {
      const storage = storages[componentName]
      for await (const update of storage.updates(startDate, endDate)) {
        const { entityId, lastModified } = update
        if (seen.has(entityId)) {
          continue
        }
        seen.add(entityId)

        const value = await this.getZipped(entityId, storages, schema)
        if (value) {
          await onEntity(entityId, value)
          nextCursor = Math.max(nextCursor, lastModified)
        }
      }
    }
    await this.cursors.write(importName, nextCursor)
  }

  async getZipped<T>(
    entityId: string,
    storages: { [componentName: string]: ComponentStorage<unknown> },
    schema: Schema<T>,
  ) {
    const value: Record<string, unknown> = {}
    for (const componentName of Object.keys(storages)) {
      value[componentName] = await storages[componentName].read(entityId)
    }
    return schema.parse(value).parsedValue
  }

  private now(): number {
    return performance.timeOrigin + performance.now()
  }
}
