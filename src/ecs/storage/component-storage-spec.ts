import { describe, expect, it } from 'vitest'
import { ComponentStorage } from '.'

export type Product = { product: string }

export default function spec(provider: () => ComponentStorage<Product>) {
  it('reads and writes', async () => {
    const product = { product: 'product-1' }
    const products = provider()
    await products.write('1', product)
    expect(await products.read('1')).toEqual(product)
  })
  it('returns all', async () => {
    const product = { product: 'product-1' }
    const products = provider()
    await products.write('1', product)
    await products.write('2', product)

    const updates = []
    for await (const { entityId } of products.all()) {
      updates.push(entityId)
    }
    expect(updates).toEqual(['1', '2'])
  })
  it('collects updates', async () => {
    const product = { product: 'product-1' }
    const products = provider()
    await products.write('1', product)
    await products.write('2', product)
    await products.write('1', product)

    const updates = []
    for await (const { entityId } of products.updates(new Date('2000-01-01'))) {
      updates.push(entityId)
    }
    expect(updates).toEqual(['2', '1'])
  })

  describe('conditional writes', () => {
    it('writes if value is the same', async () => {
      const products = provider()
      await products.write('1', { product: 'product-1' })
      await products.conditionalWrite(
        '1',
        { product: 'product-2' },
        { product: 'product-1' },
      )
      expect(await products.read('1')).toEqual({ product: 'product-2' })
    })
    it('fails if value is different', async () => {
      const products = provider()
      await products.write('1', { product: 'product-1' })
      expect(
        products.conditionalWrite(
          '1',
          { product: 'product-2' },
          { product: 'not-the-product' },
        ),
      ).rejects.toThrowError('conditional write failed')
    })
    it('writes if value is not present', async () => {
      const products = provider()
      await products.conditionalWrite('1', { product: 'product-1' }, undefined)
      expect(await products.read('1')).toEqual({ product: 'product-1' })
    })
    it('fails if value is is already there but not expected', async () => {
      const products = provider()
      await products.write('1', { product: 'product-1' })
      expect(
        products.conditionalWrite('1', { product: 'product-1' }, undefined),
      ).rejects.toThrowError('conditional write failed')
    })
  })
}
