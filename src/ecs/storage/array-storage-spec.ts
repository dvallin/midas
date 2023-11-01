import { it, expect, describe } from 'vitest'
import { ArrayStorage } from '.'

export default function spec(provider: () => ArrayStorage<string>) {
  it('reads and writes', async () => {
    const array = provider()
    await array.write('1', ['1', '2'])
    expect(await array.read('1')).toEqual(['1', '2'])
  })
  it('writes and then pushes', async () => {
    const array = provider()
    await array.write('1', ['1'])
    await array.push('1', '2')
    expect(await array.read('1')).toEqual(['1', '2'])
  })
  it('inserts on pushes', async () => {
    const array = provider()
    await array.push('1', '1')
    await array.push('1', '2')
    expect(await array.read('1')).toEqual(['1', '2'])
  })
  describe('conditional writes', () => {
    it('writes if value is the same', async () => {
      const array = provider()
      await array.write('1', ['1', '2'])
      await array.conditionalWrite('1', ['3', '2'], ['1', '2'])
      expect(await array.read('1')).toEqual(['3', '2'])
    })
    it('fails if value is different', async () => {
      const array = provider()
      await array.write('1', ['1', '2'])
      expect(
        array.conditionalWrite('1', ['3', '2'], ['3', '2']),
      ).rejects.toThrowError('conditional write failed')
    })
    it('writes if value is not present', async () => {
      const products = provider()
      await products.conditionalWrite('1', ['1', '2'], undefined)
      expect(await products.read('1')).toEqual(['1', '2'])
    })
    it('fails if value is is already there but not expected', async () => {
      const products = provider()
      await products.write('1', ['1', '2'])
      expect(
        products.conditionalWrite('1', ['1', '2'], undefined),
      ).rejects.toThrowError('conditional write failed')
    })
  })
}
