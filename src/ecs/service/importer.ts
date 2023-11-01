import { ComponentStorage } from '../storage'

export class Importer {
  constructor(private readonly cursors: ComponentStorage<number>) {}

  async runImport<T>(
    name: string,
    storage: ComponentStorage<T>,
    onEntity: (entity: string, value: T) => Promise<void>,
  ) {
    const cursor = (await this.cursors.read(name)) ?? -8640000000000000
    let nextCursor = cursor
    for await (const { entity, lastModified } of storage.updates(
      new Date(cursor),
    )) {
      const value = await storage.read(entity)
      if (value === undefined) {
        throw new Error('could not find value for entity')
      }
      await onEntity(entity, value)
      nextCursor = Math.max(nextCursor, lastModified.valueOf())
    }
    await this.cursors.write(name, nextCursor)
  }
}
