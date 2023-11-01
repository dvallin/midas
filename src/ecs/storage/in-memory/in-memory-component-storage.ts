import { ComponentStorage } from '..'

export class InMemoryComponentStorage<T> implements ComponentStorage<T> {
  protected readonly storage: Record<string, { value: T; lastModified: Date }> =
    {}

  read(entity: string): Promise<T | undefined> {
    return Promise.resolve(this.storage[entity]?.value)
  }

  write(entity: string, component: T): Promise<void> {
    this.storage[entity] = { value: component, lastModified: new Date() }
    return Promise.resolve(undefined)
  }

  async conditionalWrite(
    entity: string,
    current: T,
    previous: T | undefined,
  ): Promise<void> {
    const value = this.storage[entity]
    if (JSON.stringify(value?.value) !== JSON.stringify(previous)) {
      throw new Error('conditional write failed')
    }
    return this.write(entity, current)
  }

  async *updates(startDate: Date) {
    for (const entity of Object.keys(this.storage)) {
      const { lastModified } = this.storage[entity]
      if (lastModified > startDate) {
        yield { entity, lastModified }
      }
    }
  }
}
