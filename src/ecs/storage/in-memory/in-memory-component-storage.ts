import { ComponentStorage } from '..'

export class InMemoryComponentStorage<T> implements ComponentStorage<T> {
  protected readonly storage: Record<
    string,
    { component: T; lastModified: number }
  > = {}

  public get data() {
    return this.storage
  }

  public get size() {
    return Object.keys(this.storage).length
  }

  read(entityId: string): Promise<T | undefined> {
    return Promise.resolve(this.storage[entityId]?.component)
  }

  write(entityId: string, component: T): Promise<void> {
    this.storage[entityId] = { component, lastModified: this.now() }
    return Promise.resolve(undefined)
  }

  async conditionalWrite(
    entityId: string,
    current: T,
    previous: T | undefined,
  ): Promise<void> {
    const value = this.storage[entityId]
    if (JSON.stringify(value?.component) !== JSON.stringify(previous)) {
      throw new Error('conditional write failed')
    }
    return this.write(entityId, current)
  }

  async *all() {
    for (const entityId of Object.keys(this.storage)) {
      const { lastModified, component } = this.storage[entityId]
      yield { entityId, lastModified, component }
    }
  }

  async *updates(startDate: number, endDate?: number) {
    const result: { lastModified: number; entityId: string }[] = []
    for (const entityId of Object.keys(this.storage)) {
      const { lastModified } = this.storage[entityId]
      if (lastModified > startDate && (!endDate || lastModified < endDate)) {
        result.push({ entityId, lastModified })
      }
    }
    result.sort((a, b) => a.lastModified - b.lastModified)
    for (const { entityId, lastModified } of result) {
      yield { entityId, lastModified }
    }
  }

  private now(): number {
    return performance.timeOrigin + performance.now()
  }
}
