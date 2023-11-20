import { ComponentStorage, UpdateStorage } from '../storage'

export class Importer {
  constructor(private readonly cursors: ComponentStorage<string>) {}

  async runImport<T>(
    importName: string,
    storage: ComponentStorage<T>,
    updates: UpdateStorage,
    onEntity: (entityId: string, component: T) => Promise<unknown>,
  ) {
    const startCursor = await this.cursors.read(importName)

    let nextCursor = startCursor
    for await (const update of updates.updates(startCursor)) {
      const { entityId, cursor } = update
      const value = await storage.readOrThrow(entityId)
      await onEntity(entityId, value)
      if (nextCursor === undefined || nextCursor < cursor) {
        nextCursor = cursor
      }
    }

    if (nextCursor) {
      await this.cursors.write(importName, nextCursor)
    }
  }
}
