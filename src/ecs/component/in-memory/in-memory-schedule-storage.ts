import { ScheduleStorage } from '..'
import { InMemoryComponentStorage } from './in-memory-component-storage'

export class InMemoryScheduleStorage extends InMemoryComponentStorage<Date>
  implements ScheduleStorage {
  async *schedules(
    startDate?: Date | undefined,
  ): AsyncGenerator<{ entityId: string; cursor: string }> {
    const result: { lastModified: number; entityId: string }[] = []
    for (const entityId of Object.keys(this.storage)) {
      const { component, lastModified } = this.storage[entityId]
      if (component && (!startDate || component > startDate)) {
        result.push({ entityId, lastModified })
      }
    }
    result.sort((a, b) => a.lastModified - b.lastModified)
    for (const { entityId, lastModified } of result) {
      yield { entityId, cursor: lastModified.toString() }
    }
  }

  updates(
    cursor?: string | undefined,
  ): AsyncGenerator<{ entityId: string; cursor: string }> {
    const startDate = parseFloat(cursor ?? '0')
    return this.schedules(new Date(startDate))
  }
}
