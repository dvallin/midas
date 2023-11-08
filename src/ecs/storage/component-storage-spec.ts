import { describe, expect, it } from 'vitest'
import { ComponentStorage } from '.'

export default function spec(provider: () => ComponentStorage<string>) {
  it('reads and writes', async () => {
    const products = provider()
    await products.write('1', 'product-1')
    expect(await products.read('1')).toEqual('product-1')
  })
  it('returns all', async () => {
    const products = provider()
    await products.write('1', 'product-1')
    await products.write('2', 'product-1')

    const updates = []
    for await (const { entityId } of products.all()) {
      updates.push(entityId)
    }
    expect(updates).toEqual(['1', '2'])
  })
  it('collects updates', async () => {
    const products = provider()

    await products.write('1', 'product-1')
    await products.write('2', 'product-1')
    await products.write('1', 'product-1')

    await products.commitUpdateIndex()

    const updates = []
    for await (const { entityId } of products.updates('0')) {
      updates.push(entityId)
    }

    expect(updates).toEqual(['2', '1'])
  })

  describe('conditional writes', () => {
    it('writes if value is the same', async () => {
      const products = provider()
      await products.write('1', 'product-1')
      await products.conditionalWrite('1', 'product-2', 'product-1')
      expect(await products.read('1')).toEqual('product-2')
    })
    it('fails if value is different', async () => {
      const products = provider()
      await products.write('1', 'product-1')
      expect(
        products.conditionalWrite('1', 'product-2', 'not-the-product'),
      ).rejects.toThrowError('conditional write failed')
    })
    it('writes if value is not present', async () => {
      const products = provider()
      await products.conditionalWrite('not-present', 'product-1', undefined)
      expect(await products.read('not-present')).toEqual('product-1')
    })
    it('fails if value is is already there but not expected', async () => {
      const products = provider()
      await products.write('1', 'product-1')
      expect(
        products.conditionalWrite('1', 'product-1', undefined),
      ).rejects.toThrowError('conditional write failed')
    })
  })
}
