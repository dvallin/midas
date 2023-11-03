import { ComponentStorage } from '../storage'

export class Importer {
  constructor(
    private readonly cursors: ComponentStorage<number>,
    private readonly maxClockSkewMs = 10000,
  ) {}

  async runImport<T>(
    importName: string,
    storage: ComponentStorage<T>,
    onEntity: (entityId: string, component: T) => Promise<void>,
  ) {
    const startDate = (await this.cursors.read(importName)) ?? -8640000000000000
    const endDate = this.now() - this.maxClockSkewMs

    let nextCursor = startDate
    for await (const update of storage.updates(startDate, endDate)) {
      const { entityId, lastModified } = update
      const value = await storage.read(entityId)
      if (value === undefined) {
        throw new Error('could not find value for entity')
      }
      await onEntity(entityId, value)
      nextCursor = Math.max(nextCursor, lastModified)
    }
    await this.cursors.write(importName, nextCursor)
  }

  private now(): number {
    return performance.timeOrigin + performance.now()
  }
}
