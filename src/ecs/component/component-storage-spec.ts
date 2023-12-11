import { describe, expect, it } from 'vitest'
import { ComponentStorage, UpdateStorage } from '.'

export default function spec(
  provider: () => { storage: ComponentStorage<string>; updates: UpdateStorage },
) {
  it('reads and writes', async () => {
    const { storage } = provider()
    await storage.write('1', 'product-1')
    expect(await storage.read('1')).toEqual('product-1')
  })
  it('batch reads and writes', async () => {
    const { storage } = provider()
    const writes = []
    for (let i = 0; i < 100; i++) {
      writes.push({ entityId: i.toString(), component: `product-${i}` })
    }
    await storage.batchWrite(writes)

    const read = await storage.batchRead(writes.map((w) => w.entityId))
    for (let i = 0; i < 100; i++) {
      expect(read[i].value).toEqual(`product-${i}`)
    }
  })
  it('collects all updates', async () => {
    const { storage, updates } = provider()

    await storage.write('1', 'product-1')
    await storage.write('2', 'product-1')
    await storage.write('1', 'product-1')

    const result = []
    for await (const { entityId } of updates.updates()) {
      result.push(entityId)
    }
    expect(result).toEqual(expect.arrayContaining(['2', '1']))
  })
  it('collects updates since timestamp', async () => {
    const { storage, updates } = provider()

    await storage.write('1', 'product-1')
    const { cursor } = await storage.write('2', 'product-1')
    await storage.write('3', 'product-1')
    await storage.write('1', 'product-1')

    const result = []
    for await (const { entityId } of updates.updates(cursor)) {
      result.push(entityId)
    }

    expect(result).toEqual(['3', '1'])
  })

  describe('conditional writes', () => {
    it('writes if value is the same', async () => {
      const { storage } = provider()
      await storage.write('1', 'product-1')
      await storage.conditionalWrite('1', 'product-2', 'product-1')
      expect(await storage.read('1')).toEqual('product-2')
    })
    it('fails if value is different', async () => {
      const { storage } = provider()
      await storage.write('1', 'product-1')
      expect(
        storage.conditionalWrite('1', 'product-2', 'not-the-product'),
      ).rejects.toThrowError('conditional write failed')
    })
    it('writes if value is not present', async () => {
      const { storage } = provider()
      await storage.conditionalWrite('not-present', 'product-1', undefined)
      expect(await storage.read('not-present')).toEqual('product-1')
    })
    it('fails if value is is already there but not expected', async () => {
      const { storage } = provider()
      await storage.write('1', 'product-1')
      expect(
        storage.conditionalWrite('1', 'product-1', undefined),
      ).rejects.toThrowError('conditional write failed')
    })
  })
}
