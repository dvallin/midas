import { Schema } from '@spaceteams/zap'
import { ComponentStorage } from '../storage'
import { GetResult, getById } from './get-by-id'

export class ZipImporter {
  constructor(private readonly cursors: ComponentStorage<string>) {}

  async runImport<
    T extends { [componentName: string]: ComponentStorage<unknown> },
  >(
    importName: string,
    storages: T,
    onEntity: (entityId: string, components: GetResult<T>) => Promise<void>,
  ) {
    const startDate = (await this.cursors.read(importName)) ?? '0'

    let nextCursor = startDate
    const seen = new Set()
    for (const componentName of Object.keys(storages)) {
      const storage = storages[componentName]
      for await (const update of storage.updates(startDate)) {
        const { entityId, cursor } = update
        if (seen.has(entityId)) {
          continue
        }
        seen.add(entityId)

        const value = await getById(entityId, storages)
        if (value) {
          await onEntity(entityId, value)
          nextCursor =
            cursor.localeCompare(nextCursor) > 0 ? cursor : nextCursor
        }
      }
    }
    await this.cursors.write(importName, nextCursor)
  }

  runImportWithSchema<
    T extends { [componentName: string]: ComponentStorage<unknown> },
    I,
    O = I,
  >(
    importName: string,
    storages: T,
    schema: Schema<I, O>,
    onEntity: (entityId: string, components: O) => Promise<void>,
  ) {
    return this.runImport(
      importName,
      storages,
      async (entityId, components) => {
        const { parsedValue } = schema.parse(components)
        if (parsedValue) {
          await onEntity(entityId, parsedValue)
        }
      },
    )
  }
}
