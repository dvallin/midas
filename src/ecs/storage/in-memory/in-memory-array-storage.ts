import { InMemoryComponentStorage } from './in-memory-component-storage'
import { ArrayStorage } from '..'

export class InMemoryArrayStorage<T>
  extends InMemoryComponentStorage<T[]>
  implements ArrayStorage<T>
{
  async push(entityId: string, component: T): Promise<void> {
    if (!this.storage[entityId]) {
      await this.write(entityId, [])
    }
    this.storage[entityId]?.component.push(component)
  }
}
