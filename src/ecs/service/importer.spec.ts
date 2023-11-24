import { expect, it } from 'vitest'
import { Importer } from './importer'
import { InMemoryComponentStorage, InMemoryUpdateStorage } from '../storage'

const storage = new InMemoryUpdateStorage<string>()
await storage.write('1', 'component-1')
await storage.write('2', 'component-2')
await storage.write('3', 'component-3')

it('imports', async () => {
  const cursors = new InMemoryComponentStorage<string>()
  const importer = new Importer({
    name: 'test',
    cursors,
    storage,
    updateStorage: storage,
  })

  const imported = new InMemoryComponentStorage<string>()
  await importer.runImport((entityId, component) =>
    imported.write(entityId, component!)
  )

  expect(imported.size).toEqual(storage.size)
  expect(imported.data[1].component).toEqual('component-1')
  expect(imported.data[2].component).toEqual('component-2')
  expect(imported.data[3].component).toEqual('component-3')
  expect(parseInt(cursors.data.test.component)).toBeGreaterThan(0)
})

it('imports only once', async () => {
  const importer = new Importer({
    name: 'test',
    cursors: new InMemoryComponentStorage<string>(),
    storage,
    updateStorage: storage,
  })

  const imported = new InMemoryComponentStorage<string>()
  await importer.runImport((entityId, component) =>
    imported.write(entityId, component!)
  )
  await importer.runImport((entityId, component) =>
    imported.write(entityId, component!)
  )

  expect(imported.size).toEqual(storage.size)
})
