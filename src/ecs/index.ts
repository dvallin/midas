import { Schema } from '@spaceteams/zap'
import { ContextExtensionMiddleware } from '../middleware'

export * as entity from './entity'
export * as service from './service'
export * as component from './component'

export type StorageConfig = { batchSize?: number }

export type ComponentStorageConfig =
  | {
    type: 'memory'
  }
  | { type: 'dynamo' }
  | { type: 'elastic' }
export type ComponentConfig = {
  type: 'key' | 'set' | 'array' | 'default' | 'schedule'
  tracksUpdates: boolean
  schema?: Schema<unknown>
  storageConfig: ComponentStorageConfig
}
const defaultStorageConfig: ComponentStorageConfig = { type: 'memory' }
export function componentStorageConfig(
  config: Partial<ComponentStorageConfig>,
): ComponentStorageConfig {
  return { ...defaultStorageConfig, ...config }
}

const defaultConfig: ComponentConfig = {
  type: 'default',
  tracksUpdates: false,
  storageConfig: { type: 'memory' },
}
export function componentConfig(
  config: Partial<ComponentConfig>,
): ComponentConfig {
  return { ...defaultConfig, ...config }
}

export type EcsBaseContext<
  Components extends {
    [componentName: string]: ComponentConfig
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
    [componentName: string]: ComponentConfig
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
    const c = ctx as Record<string, unknown>
    c.clusterId = clusterId
    c.components = components
    return await next(ctx as C & EcsBaseContext<Components>)
  }
}
