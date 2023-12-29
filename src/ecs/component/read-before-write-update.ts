import { ComponentStorage } from '.'

export class ReadBeforeWriteUpdate<T> {
  constructor(readonly storage: ComponentStorage<T>) {}

  async update(
    entityId: string,
    updater: (previous: T | null | undefined) => T,
  ): Promise<{ cursor: string; component: T }> {
    const previous = await this.storage.read(entityId)
    const component = updater(previous)
    const result = await this.storage.conditionalWrite(
      entityId,
      component,
      previous,
    )
    return {
      ...result,
      component,
    }
  }
}
