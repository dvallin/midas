import { ComponentStorage } from '..'
import { ElasticsearchStorage } from './elasticsearch-storage'

export class ElasticsearchComponentStorage<T> implements ComponentStorage<T> {
  constructor(
    protected readonly componentName: string,
    protected readonly storage: ElasticsearchStorage,
  ) {}

  getIndex() {
    return `components_${this.componentName}`.toLocaleLowerCase()
  }

  async read(entityId: string): Promise<T | undefined> {
    const result = await this.storage.read<T>(this.componentName, entityId)
    return result._source?.component
  }

  async readOrThrow(entityId: string): Promise<T> {
    const value = await this.read(entityId)
    if (value === undefined) {
      throw new Error(
        `could not find component ${this.componentName} for entity ${entityId}`,
      )
    }
    return value
  }

  write(entityId: string, component: T): Promise<{ cursor: string }> {
    return this.storage.write(this.componentName, entityId, component)
  }

  async conditionalWrite(
    entityId: string,
    current: T,
    previous: T | undefined,
  ): Promise<{ cursor: string }> {
    return this.storage.conditionalWrite(
      this.componentName,
      entityId,
      current,
      previous,
    )
  }
}
