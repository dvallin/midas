import { ComponentConfig, ComponentType } from '..'
import { EntityId } from '../entity'

export interface GroupedStorage<
  Components extends {
    [componentName: string]: ComponentConfig<unknown>
  },
> {
  read(entityId: EntityId): Promise<
    {
      [componentName in keyof Components]?:
        | ComponentType<
          Components[componentName]
        >
        | null
    }
  >
  write(
    entityId: string,
    components: {
      [componentName in keyof Components]: ComponentType<
        Components[componentName]
      >
    },
  ): Promise<{ cursor: string }>
  delete(entityId: string): Promise<{ cursor: string }>
  erase(entityId: string): Promise<void>
}
