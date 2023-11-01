import { ArrayStorage, InMemoryComponentStorage } from '..'

export class InMemoryArrayStorage<T>
  extends InMemoryComponentStorage<T[]>
  implements ArrayStorage<T>
{
  async push(entity: string, component: T): Promise<void> {
    if (!this.storage[entity]) {
      await this.write(entity, [])
    }
    this.storage[entity]?.value.push(component)
  }
}
