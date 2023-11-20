import { Schema } from '@spaceteams/zap'
import { ComponentStorage, UpdateStorage } from '../storage'
import { GetResult, getById } from './get-by-id'

export class ZipImporter {
  constructor(private readonly cursors: ComponentStorage<string>) {}

  async runImport<
    T extends {
      [componentName: string]: ComponentStorage<unknown>
    },
    U extends {
      [componentName: string]: UpdateStorage
    },
  >(
    importName: string,
    storages: T,
    updates: U,
    onEntity: (entityId: string, components: GetResult<T>) => Promise<void>,
  ) {
    const startDate = (await this.cursors.read(importName)) ?? '0'

    let nextCursor = startDate
    const seen = new Set()
    for (const componentName of Object.keys(storages)) {
      const updateStorage = updates[componentName]
      if (updateStorage === undefined) {
        continue
      }
      for await (const update of updateStorage.updates(startDate)) {
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
    U extends {
      [componentName: string]: UpdateStorage
    },
    I,
    O = I,
  >(
    importName: string,
    storages: T,
    updates: U,
    schema: Schema<I, O>,
    onEntity: (entityId: string, components: O) => Promise<unknown>,
  ) {
    return this.runImport(
      importName,
      storages,
      updates,
      async (entityId, components) => {
        const { parsedValue } = schema.parse(components)
        if (parsedValue) {
          await onEntity(entityId, parsedValue)
        }
      },
    )
  }
}
