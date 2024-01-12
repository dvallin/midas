import { DynamoDbComponentStorage } from './dynamo-db-component-storage'
import { DynamoDbGroupedStorage } from './dynamo-db-grouped-storage'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDynamoDbStorage } from './create-test-dynamo-db-storage'
import { string } from '@spaceteams/zap'
import { componentConfig, componentStorageConfig } from '../..'

const { storage } = await createTestDynamoDbStorage(
  'dynamo-db-component-storage',
  {
    a: componentConfig({
      tracksUpdates: false,
      group: 'group',
      schema: string(),
      storageConfig: componentStorageConfig({ type: 'dynamo' }),
    }),
    b: componentConfig({
      tracksUpdates: false,
      group: 'group',
      schema: string(),
      storageConfig: componentStorageConfig({ type: 'dynamo' }),
    }),
  },
)

beforeAll(() => storage.migrate())
afterAll(() => storage.teardown())

describe('group storage', () => {
  it('reads a group', async () => {
    const a = new DynamoDbComponentStorage('a', storage)
    const b = new DynamoDbComponentStorage('b', storage)

    await a.write('item-1', 'a-value')
    await b.write('item-1', 'b-value')

    const group = new DynamoDbGroupedStorage({ a, b }, storage)
    const result = await group.read('item-1')

    expect(result.a).toEqual('a-value')
    expect(result.b).toEqual('b-value')
  })

  it('writes a group', async () => {
    const a = new DynamoDbComponentStorage('a', storage)
    const b = new DynamoDbComponentStorage('b', storage)
    const group = new DynamoDbGroupedStorage({ a, b }, storage)

    await group.write('item-2', { a: 'a-value', b: 'b-value' })
    await group.write('item-2', { a: 'c-value' })

    const result = await group.read('item-2')

    expect(result.a).toEqual('c-value')
    expect(result.b).toEqual('b-value')
  })
})
