import { Schema } from '@spaceteams/zap'
import { ComponentStorage, UpdateStorage } from '../component'
import { Batcher } from './batcher'
import { Query } from './queries'
import { EntityId } from '../entity'

export type ImporterConfig<T> = {
  name: string
  cursors: ComponentStorage<string>
  storage: ComponentStorage<T>
  updateStorage: UpdateStorage
  batchSize?: number
}

export class Importer<T> {
  private readonly importName: string
  private readonly cursors: ComponentStorage<string>
  private readonly storage: ComponentStorage<T>
  private readonly updateStorage: UpdateStorage
  private readonly batcher: Batcher
  private readonly query: Query<{ storage: ComponentStorage<T> }>
  constructor(config: ImporterConfig<T>) {
    this.importName = config.name
    this.cursors = config.cursors
    this.storage = config.storage
    this.updateStorage = config.updateStorage
    this.batcher = new Batcher(config.batchSize ?? 10)
    this.query = new Query({ storage: this.storage })
  }

  async runImport(
    onEntity: (
      entityId: EntityId,
      component: T | undefined,
    ) => Promise<unknown>,
  ) {
    const startCursor = await this.cursors.read(this.importName)

    let nextCursor = startCursor
    for await (
      const batch of this.batcher.batch(
        this.updateStorage.updates(startCursor ?? undefined),
      )
    ) {
      if (batch.length === 0) {
        continue
      }

      const ids = batch.map((b) => b.entityId)
      const components = await this.query.getManyById(ids)
      for (const id of ids) {
        await onEntity(id, components[id].storage)
      }

      const cursor = batch
        .map((a) => a.cursor)
        .reduce((a, b) => (a < b ? b : a))
      if (!nextCursor || nextCursor < cursor) {
        console.log(nextCursor, cursor)
        nextCursor = cursor
      }
    }

    if (nextCursor) {
      await this.cursors.write(this.importName, nextCursor)
    }
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
