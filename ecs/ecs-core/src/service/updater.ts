import { ComponentStorage, UpdateStorage } from '../component'
import { Batcher } from './batcher'
import { EntityId } from '../entity'

export type UpdaterConfig = {
  name: string
  cursors: ComponentStorage<string>
  updateStorage: UpdateStorage
  batchSize?: number
}

export class Updater {
  private readonly importName: string
  private readonly cursors: ComponentStorage<string>
  private readonly updateStorage: UpdateStorage
  private readonly batcher: Batcher
  constructor(config: UpdaterConfig) {
    this.importName = config.name
    this.cursors = config.cursors
    this.updateStorage = config.updateStorage
    this.batcher = new Batcher(config.batchSize ?? 10)
  }

  async runUpdate(onEntity: (entityId: EntityId) => Promise<unknown>) {
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
      for (const id of ids) {
        await onEntity(id)
      }

      const cursor = batch
        .map((a) => a.cursor)
        .reduce((a, b) => (a < b ? b : a))
      if (!nextCursor || nextCursor < cursor) {
        nextCursor = cursor
      }
    }

    if (nextCursor) {
      await this.cursors.write(this.importName, nextCursor)
    }
  }
}
