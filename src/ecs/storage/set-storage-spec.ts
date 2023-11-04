import { describe, expect, it } from 'vitest'
import { SetStorage } from '.'

export default function spec(provider: () => SetStorage<string>) {
  it('reads and writes', async () => {
    const array = provider()
    await array.write('read-and-write', ['1', '2'])
    expect(await array.read('read-and-write')).toEqual(['1', '2'])
  })
  it('adds values', async () => {
    const array = provider()
    await array.write('add-value', ['1'])
    await array.add('add-value', '2')
    await array.add('add-value', '2')
    expect(await array.read('add-value')).toEqual(['1', '2'])
  })
  it('deletes values', async () => {
    const array = provider()
    await array.write('delete-value', ['1'])
    await array.delete('delete-value', '1')
    expect(await array.read('delete-value')).toEqual([])
  })
  it('inserts on add', async () => {
    const array = provider()
    await array.add('insert-on-add', '1')
    await array.add('insert-on-add', '2')
    expect(await array.read('insert-on-add')).toEqual(['1', '2'])
  })
  describe('conditional writes', () => {
    it('writes if value is the same', async () => {
      const array = provider()
      await array.write('write-if-present', ['1', '2'])
      await array.conditionalWrite('write-if-present', ['3', '2'], ['1', '2'])
      expect(await array.read('write-if-present')).toEqual(
        expect.arrayContaining(['3', '2']),
      )
    })
    it('fails if value is different', async () => {
      const array = provider()
      await array.write('fail-if-different', ['1', '2'])
      expect(
        array.conditionalWrite('fail-if-different', ['3', '2'], ['3', '2']),
      ).rejects.toThrowError('conditional write failed')
    })
    it('writes if value is not present', async () => {
      const products = provider()
      await products.conditionalWrite(
        'write-if-not-present',
        ['1', '2'],
        undefined,
      )
      expect(await products.read('write-if-not-present')).toEqual(['1', '2'])
    })
    it('fails if value is is already there but not expected', async () => {
      const products = provider()
      await products.write('fail-if-present', ['1', '2'])
      expect(
        products.conditionalWrite('fail-if-present', ['1', '2'], undefined),
      ).rejects.toThrowError('conditional write failed')
    })
  })
}
