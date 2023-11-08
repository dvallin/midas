import { describe, expect, it } from 'vitest'
import { ArrayStorage } from '.'

export default function spec(provider: () => ArrayStorage<string>) {
  it('reads and writes', async () => {
    const storage = provider()
    await storage.write('read-and-write', ['1', '2'])
    expect(await storage.read('read-and-write')).toEqual(['1', '2'])
  })
  it('writes and then pushes', async () => {
    const storage = provider()
    await storage.write('write-and-push', ['1'])
    await storage.push('write-and-push', '2')
    expect(await storage.read('write-and-push')).toEqual(['1', '2'])
  })
  it('inserts on pushes', async () => {
    const storage = provider()
    await storage.push('insert-on-push', '1')
    await storage.push('insert-on-push', '2')
    expect(await storage.read('insert-on-push')).toEqual(['1', '2'])
  })
  describe('conditional writes', () => {
    it('writes if value is the same', async () => {
      const storage = provider()
      await storage.write('write-if-present', ['1', '2'])
      await storage.conditionalWrite('write-if-present', ['3', '2'], ['1', '2'])
      expect(await storage.read('write-if-present')).toEqual(['3', '2'])
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
}
