import { InferType, Schema } from '@spaceteams/zap'
import { ContextExtensionMiddleware } from '../../../middleware/middleware-core'

export * from './entity'
export * from './component'
export * from './service'

/**
 * When a component storage should validate the component against the schema
 * read: _only_ on reading the data
 * write: _only_ on writing the data
 * all: on reading and writing the data
 */
export type ValidationMode = 'read' | 'write' | 'all'

export type StorageConfig = {
  batchSize?: number
  validationMode?: ValidationMode
}

export type ComponentStorageConfig =
  | {
    type: 'memory'
  }
  | { type: 'dynamo' }
  | { type: 'elastic' }
export type ComponentConfig<T> = {
  type: 'key' | 'set' | 'array' | 'default' | 'schedule'
  tracksUpdates?: boolean
  schema?: Schema<T>
  group?: string
  storageConfig: StorageConfig & ComponentStorageConfig
}
export type ComponentType<T extends { schema?: unknown }> = T['schema'] extends
  undefined ? unknown : InferType<T['schema']>
const defaultComponentStorageConfig: StorageConfig & ComponentStorageConfig = {
  type: 'memory',
}
export function componentStorageConfig(
  config: Partial<ComponentStorageConfig>,
): ComponentStorageConfig {
  return { ...defaultComponentStorageConfig, ...config }
}

const defaultComponentConfig: ComponentConfig<unknown> = {
  type: 'default',
  storageConfig: defaultComponentStorageConfig,
}
export function componentConfig<T>(
  config: Partial<ComponentConfig<T>>,
): ComponentConfig<T> {
  return { ...defaultComponentConfig, ...config } as ComponentConfig<T>
}

export type EcsBaseContext<
  Components extends {
    [componentName: string]: ComponentConfig<unknown>
  },
> = {
  clusterId: string
  components: Components
  storage: StorageConfig
}
export type InferComponents<T> = T extends EcsBaseContext<infer C> ? C : never

export const ecsBaseMiddleware = <
  C,
  Components extends {
    [componentName: string]: ComponentConfig<unknown>
  },
>(
  clusterId: string,
  components: Components,
): ContextExtensionMiddleware<
  C,
  // not any base context but the one with these components
  EcsBaseContext<Components>
> => {
  return async (_e, ctx, next) => {
    console.log('build base context')
    const c = ctx as Record<string, unknown>
    c.clusterId = clusterId
    c.components = components
    return await next(ctx as C & EcsBaseContext<Components>)
  }
}
