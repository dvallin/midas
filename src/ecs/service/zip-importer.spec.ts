import { expect, it } from 'vitest'
import { ZipImporter } from './zip-importer'
import { InferType, object, optional, string } from '@spaceteams/zap'
import { InMemoryComponentStorage, InMemoryUpdateStorage } from '../component'

const storage = new InMemoryUpdateStorage<string>()
await storage.write('1', 'component-1')
await storage.write('2', 'component-2')
await storage.write('3', 'component-3')
const storage2 = new InMemoryUpdateStorage<string>()
await storage2.write('1', 'component-1')
await storage2.write('3', 'component-3')
const storage3 = new InMemoryUpdateStorage<string>()
await storage3.write('1', 'component-1')

const schema = object({
  storage: string(),
  storage2: string(),
  storage3: optional(string()),
})

it('imports zipped over multiple storages', async () => {
  const cursors = new InMemoryComponentStorage<string>()
  const importer = new ZipImporter({
    name: 'test',
    cursors,
    storages: { storage, storage2, storage3 },
    updateStorages: { storage, storage2 },
  })

  const imported = new InMemoryComponentStorage<InferType<typeof schema>>()
  await importer.runImportWithSchema(
    schema,
    (entityId, component) => imported.write(entityId, component),
  )

  expect(imported.size).toEqual(2)
  expect(imported.data[1].component).toEqual({
    storage: 'component-1',
    storage2: 'component-1',
    storage3: 'component-1',
  })
  expect(imported.data[2]).toBeUndefined()
  expect(imported.data[3].component).toEqual({
    storage: 'component-3',
    storage2: 'component-3',
  })
  expect(parseInt(cursors.data.test.component)).toBeGreaterThan(0)
})
