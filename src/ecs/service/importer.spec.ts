import { expect, it } from 'vitest'
import { Importer } from './importer'
import { InMemoryComponentStorage } from '../storage'

const storage = new InMemoryComponentStorage<string>()
await storage.write('1', 'component-1')
await storage.write('2', 'component-2')
await storage.write('3', 'component-3')

it('imports', async () => {
  const cursors = new InMemoryComponentStorage<number>()
  const importer = new Importer(cursors)

  const imported = new InMemoryComponentStorage<string>()
  await importer.runImport(
    'test',
    storage,
    (entityId, component) => imported.write(entityId, component),
  )

  expect(imported.size).toEqual(storage.size)
  expect(imported.data[1].component).toEqual('component-1')
  expect(imported.data[2].component).toEqual('component-2')
  expect(imported.data[3].component).toEqual('component-3')
  expect(cursors.data.test.component).toBeGreaterThan(0)
})

it('imports only once', async () => {
  const importer = new Importer(new InMemoryComponentStorage<number>())

  const imported = new InMemoryComponentStorage<string>()
  await importer.runImport(
    'test',
    storage,
    (entityId, component) => imported.write(entityId, component),
  )
  await importer.runImport(
    'test',
    storage,
    (entityId, component) => imported.write(entityId, component),
  )

  expect(imported.size).toEqual(storage.size)
})
