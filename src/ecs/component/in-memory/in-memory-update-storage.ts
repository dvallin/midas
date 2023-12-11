import { UpdateStorage } from '..'
import { InMemoryComponentStorage } from './in-memory-component-storage'

export class InMemoryUpdateStorage<T> extends InMemoryComponentStorage<T>
  implements UpdateStorage {
  async *updates(cursor?: string) {
    const startDate = parseFloat(cursor ?? '0')
    const result: { lastModified: number; entityId: string }[] = []
    for (const entityId of Object.keys(this.storage)) {
      const { lastModified } = this.storage[entityId]
      if (lastModified > startDate) {
        result.push({ entityId, lastModified })
      }
    }
    result.sort((a, b) => a.lastModified - b.lastModified)
    for (const { entityId, lastModified } of result) {
      yield { entityId, cursor: lastModified.toString() }
    }
  }
}
