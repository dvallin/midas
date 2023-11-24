import { InMemoryComponentStorage } from './in-memory-component-storage'
import { SetStorage } from '..'

export class InMemorySetStorage<T> extends InMemoryComponentStorage<T[]>
  implements SetStorage<T> {
  async add(entityId: string, component: T): Promise<{ cursor: string }> {
    const value = await this.read(entityId)
    const current = new Set(value ?? [])
    current.add(component)
    return this.conditionalWrite(entityId, Array.from(current), value)
  }

  async delete(entityId: string, component: T): Promise<{ cursor: string }> {
    const value = await this.read(entityId)
    const current = new Set(value ?? [])
    current.delete(component)
    return this.conditionalWrite(entityId, Array.from(current), value)
  }
}
