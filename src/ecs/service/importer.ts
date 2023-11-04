import { ComponentStorage } from '../storage'

export class Importer {
  constructor(private readonly cursors: ComponentStorage<string>) {}

  async runImport<T>(
    importName: string,
    storage: ComponentStorage<T>,
    onEntity: (entityId: string, component: T) => Promise<void>,
  ) {
    const startCursor = (await this.cursors.read(importName)) ?? '0'

    let nextCursor = startCursor
    for await (const update of storage.updates(startCursor)) {
      const { entityId, cursor } = update
      const value = await storage.read(entityId)
      if (value === undefined) {
        throw new Error('could not find value for entity')
      }
      await onEntity(entityId, value)
      nextCursor = cursor
    }
    await this.cursors.write(importName, nextCursor)
  }
}
