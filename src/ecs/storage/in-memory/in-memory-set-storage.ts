import { InMemoryComponentStorage, SetStorage } from '..'

export class InMemorySetStorage<T>
  extends InMemoryComponentStorage<T[]>
  implements SetStorage<T>
{
  async add(entity: string, component: T): Promise<void> {
    const value = await this.read(entity)
    const current = new Set(value ?? [])
    current.add(component)
    return this.conditionalWrite(entity, Array.from(current), value)
  }

  async delete(entity: string, component: T): Promise<void> {
    const value = await this.read(entity)
    const current = new Set(value ?? [])
    current.delete(component)
    return this.conditionalWrite(entity, Array.from(current), value)
  }
}
