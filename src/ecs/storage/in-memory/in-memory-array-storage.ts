import { InMemoryComponentStorage } from './in-memory-component-storage'
import { ArrayStorage } from '..'

export class InMemoryArrayStorage<T> extends InMemoryComponentStorage<T[]>
  implements ArrayStorage<T> {
  async push(entityId: string, component: T): Promise<{ cursor: string }> {
    const value = await this.read(entityId)
    const current = value ?? []
    current.push(component)
    return this.conditionalWrite(entityId, Array.from(current), value)
  }
}
