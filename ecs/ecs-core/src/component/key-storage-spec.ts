import { describe, expect, it } from 'vitest'
import { KeyStorage } from '.'

export default function spec(provider: () => KeyStorage) {
  it('reads and writes', async () => {
    const storage = provider()
    await storage.write('read-and-write', 'read-and-write-value')
    expect(await storage.read('read-and-write')).toEqual('read-and-write-value')
  })
  it('gets by key', async () => {
    const storage = provider()
    await storage.write('gets-by-key', 'gets-by-key-value')
    expect(await storage.getByKey('gets-by-key-value')).toEqual('gets-by-key')
  })
  describe('conditional writes', () => {
    it('writes if value is the same', async () => {
      const storage = provider()
      await storage.write('write-if-present', '1')
      await storage.conditionalWrite('write-if-present', '2', '1')
      expect(await storage.read('write-if-present')).toEqual('2')
    })
    it('fails if value is different', async () => {
      const storage = provider()
      await storage.write('fail-if-different', '1')
      expect(
        storage.conditionalWrite('fail-if-different', '2', '2'),
      ).rejects.toThrowError('conditional write failed')
    })
    it('writes if value is not present', async () => {
      const products = provider()
      await products.conditionalWrite('write-if-not-present', '1', undefined)
      expect(await products.read('write-if-not-present')).toEqual('1')
    })
    it('fails if value is is already there but not expected', async () => {
      const products = provider()
      await products.write('fail-if-present', '1')
      expect(
        products.conditionalWrite('fail-if-present', '1', undefined),
      ).rejects.toThrowError('conditional write failed')
    })
  })
}
