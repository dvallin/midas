import { InMemoryComponentStorage } from './in-memory-component-storage'
import { SetStorage } from '..'

export class InMemorySetStorage<T> extends InMemoryComponentStorage<T[]>
  implements SetStorage<T> {
  async setAdd(
    entityId: string,
    ...components: T[]
  ): Promise<{ cursor: string }> {
    const value = await this.read(entityId)
    const current = new Set(value ?? [])
    for (const c of components) {
      current.add(c)
    }
    return this.conditionalWrite(entityId, Array.from(current), value)
  }

  async conditionalSetAdd(
    entityId: string,
    ...components: T[]
  ): Promise<{ cursor: string }> {
    const value = await this.read(entityId)
    const current = new Set(value ?? [])
    if (components.some((c) => current.has(c))) {
      return Promise.reject(new Error('conditional add failed'))
    }
    for (const c of components) {
      current.add(c)
    }
    return this.conditionalWrite(entityId, Array.from(current), value)
  }

  async setDelete(
    entityId: string,
    ...components: T[]
  ): Promise<{ cursor: string }> {
    const value = await this.read(entityId)
    const current = new Set(value ?? [])
    for (const c of components) {
      current.delete(c)
    }
    return this.conditionalWrite(entityId, Array.from(current), value)
  }

  async conditionalSetDelete(
    entityId: string,
    ...components: T[]
  ): Promise<{ cursor: string }> {
    const value = await this.read(entityId)
    const current = new Set(value ?? [])
    if (components.some((c) => !current.has(c))) {
      return Promise.reject(new Error('conditional delete failed'))
    }
    for (const c of components) {
      current.delete(c)
    }
    return this.conditionalWrite(entityId, Array.from(current), value)
  }
}
