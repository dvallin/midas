import { describe, expect, it } from 'vitest'
import { SetStorage } from '.'

export default function spec(provider: () => SetStorage<string>) {
  it('reads and writes', async () => {
    const storage = provider()
    await storage.write('read-and-write', ['1', '2'])
    expect(await storage.read('read-and-write')).toEqual(['1', '2'])
  })
  describe('conditional writes', () => {
    it('writes if value is the same', async () => {
      const storage = provider()
      await storage.write('write-if-present', ['1', '2'])
      await storage.conditionalWrite('write-if-present', ['3', '2'], ['1', '2'])
      expect(await storage.read('write-if-present')).toEqual(
        expect.arrayContaining(['3', '2']),
      )
    })
    it('fails if value is different', async () => {
      const storage = provider()
      await storage.write('fail-if-different', ['1', '2'])
      expect(
        storage.conditionalWrite('fail-if-different', ['3', '2'], ['3', '2']),
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
  it('adds values', async () => {
    const storage = provider()
    await storage.write('add-value', ['1'])
    await storage.setAdd('add-value', '2')
    await storage.setAdd('add-value', '2')
    expect(await storage.read('add-value')).toEqual(['1', '2'])
  })
  it('inserts on add', async () => {
    const storage = provider()
    await storage.setAdd('insert-on-add', '1')
    await storage.setAdd('insert-on-add', '2', '3')
    expect(await storage.read('insert-on-add')).toEqual(['1', '2', '3'])
  })
  describe('conditional add', () => {
    it('adds if value is not already present', async () => {
      const storage = provider()
      await storage.write('add-if-not-present', ['1', '2'])
      await storage.conditionalSetAdd('add-if-not-present', '3')
      expect(await storage.read('add-if-not-present')).toEqual(
        expect.arrayContaining(['1', '2', '3']),
      )
    })
    it('adds multiple values if not already present', async () => {
      const storage = provider()
      await storage.write('add-multiple-if-not-present', ['1', '2'])
      await storage.conditionalSetAdd('add-multiple-if-not-present', '3', '4')
      expect(await storage.read('add-multiple-if-not-present')).toEqual(
        expect.arrayContaining(['1', '2', '3', '4']),
      )
    })
    it('inserts if value is not already present', async () => {
      const storage = provider()
      await storage.conditionalSetAdd('insert-if-not-present', '3')
      expect(await storage.read('insert-if-not-present')).toEqual(
        expect.arrayContaining(['3']),
      )
    })
    it('fails if value already present', async () => {
      const storage = provider()
      await storage.write('fail-add-if-present', ['1', '3'])
      expect(
        storage.conditionalSetAdd('fail-add-if-present', '3'),
      ).rejects.toThrowError('conditional add failed')
    })
    it('fails if one of multiple value already present', async () => {
      const storage = provider()
      await storage.write('fail-multiple-add-if-present', ['1', '3'])
      expect(
        storage.conditionalSetAdd('fail-multiple-add-if-present', '4', '3'),
      ).rejects.toThrowError('conditional add failed')
    })
  })
  it('deletes values', async () => {
    const storage = provider()
    await storage.write('delete-value', ['1'])
    await storage.setDelete('delete-value', '1')
    expect(await storage.read('delete-value')).toEqual([])
  })
  describe('conditional delete', () => {
    it('delete if value is already present', async () => {
      const storage = provider()
      await storage.write('delete-if-present', ['1', '2'])
      await storage.conditionalSetDelete('delete-if-present', '2')
      expect(await storage.read('delete-if-present')).toEqual(['1'])
    })
    it('fails if value not already present', async () => {
      const storage = provider()
      await storage.write('delete-fail-if-not-present', ['1', '3'])
      expect(
        storage.conditionalSetDelete('delete-fail-if-not-present', '2'),
      ).rejects.toThrowError('conditional delete failed')
    })
  })
}
