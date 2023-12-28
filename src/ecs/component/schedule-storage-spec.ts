import { expect, it } from 'vitest'
import { ComponentStorage, ScheduleStorage } from '.'
import { subDays } from 'date-fns'

export default function spec(
  provider: () => {
    storage: ComponentStorage<string>
    schedules: ScheduleStorage
  },
) {
  const yesterday = subDays(new Date(), 1)
  const today = new Date()

  it('collects all updates', async () => {
    const { storage, schedules } = provider()

    await storage.write('all-1', 'product-1')
    await storage.write('all-2', 'product-1')
    await storage.write('all-1', 'product-1')
    await schedules.write('all-1', yesterday)

    const result = []
    for await (const { entityId } of schedules.schedules()) {
      result.push(entityId)
    }
    expect(result).toEqual(expect.arrayContaining(['all-1']))
    expect(result).toEqual(expect.not.arrayContaining(['all-2']))
  })

  it('collects updates starting from date', async () => {
    const { storage, schedules } = provider()
    await storage.write('from-date-1', 'product-1')
    await storage.write('from-date-2', 'product-1')
    await storage.write('from-date-1', 'product-1')
    await schedules.write('from-1', yesterday)
    await schedules.write('from-2', today)

    const result = []
    for await (const { entityId } of schedules.schedules(yesterday)) {
      result.push(entityId)
    }
    expect(result).toEqual(expect.arrayContaining(['from-2']))
    expect(result).toEqual(expect.not.arrayContaining(['from-1']))
  })

  it('resets next update', async () => {
    const { storage, schedules } = provider()
    await storage.write('reset-1', 'product-1')
    await storage.write('reset-2', 'product-1')
    await storage.write('reset-1', 'product-1')
    await schedules.write('reset-1', today)
    await schedules.write('reset-2', today)
    await schedules.erase('reset-1')

    const result = []
    for await (const { entityId } of schedules.schedules(yesterday)) {
      result.push(entityId)
    }

    expect(result).toEqual(expect.arrayContaining(['reset-2']))
    expect(result).toEqual(expect.not.arrayContaining(['reset-1']))
  })
}
