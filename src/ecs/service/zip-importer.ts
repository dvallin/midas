import { Schema } from '@spaceteams/zap'
import { ComponentStorage, UpdateStorage } from '../component'
import { GetResult, Query } from './queries'
import { Batcher } from './batcher'
import { EntityId } from '../entity'

export type ComponentStorages = {
  [componentName: string]: ComponentStorage<unknown>
}
export type UpdateStorages = {
  [componentName: string]: UpdateStorage
}

export type ZipImporterConfig<
  T extends ComponentStorages,
  U extends UpdateStorages,
> = {
  name: string
  cursors: ComponentStorage<string>
  storages: T
  updateStorages: U
  batchSize?: number
}

export class ZipImporter<
  T extends ComponentStorages,
  U extends UpdateStorages,
> {
  private readonly importName: string
  private readonly cursors: ComponentStorage<string>
  private readonly storages: T
  private readonly updateStorages: U
  private readonly batcher: Batcher
  private readonly query: Query<T>
  constructor(config: ZipImporterConfig<T, U>) {
    this.importName = config.name
    this.cursors = config.cursors
    this.storages = config.storages
    this.updateStorages = config.updateStorages
    this.batcher = new Batcher(config.batchSize ?? 10)
    this.query = new Query(this.storages)
  }

  async runImport(
    onEntity: (entityId: EntityId, components: GetResult<T>) => Promise<void>,
  ) {
    const startCursor = (await this.cursors.read(this.importName)) ?? '0'

    let nextCursor = startCursor
    const seen = new Set()
    for (const componentName of Object.keys(this.storages)) {
      const updateStorage = this.updateStorages[componentName]
      if (updateStorage === undefined) {
        continue
      }
      for await (
        const batch of this.batcher.batch(
          updateStorage.updates(startCursor),
        )
      ) {
        const freshBatch = batch.filter((b) => !seen.has(b.entityId))
        if (freshBatch.length === 0) {
          continue
        }

        const ids = freshBatch.map((b) => b.entityId)
        const components = await this.query.getManyById(ids)
        for (const id of ids) {
          seen.add(id)
          await onEntity(id, components[id])
        }

        const cursor = freshBatch
          .map((a) => a.cursor)
          .reduce((a, b) => (a < b ? b : a))
        if (nextCursor === undefined || nextCursor < cursor) {
          nextCursor = cursor
        }
      }
    }
    await this.cursors.write(this.importName, nextCursor)
  }

  runImportWithSchema<I, O = I>(
    schema: Schema<I, O>,
    onEntity: (entityId: EntityId, components: O) => Promise<unknown>,
  ) {
    return this.runImport(async (entityId, components) => {
      const { parsedValue } = schema.parse(components)
      if (parsedValue) {
        await onEntity(entityId, parsedValue)
      }
    })
  }
}
