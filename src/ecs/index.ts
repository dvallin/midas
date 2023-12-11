import { Schema } from '@spaceteams/zap'
import { ContextExtensionMiddleware } from '../middleware'

export * as entity from './entity'
export * as service from './service'
export * as component from './component'

export type EcsBaseContext = {
  clusterId: string
  components: {
    [name: string]: {
      type: 'key' | 'set' | 'array' | 'default'
      tracksUpdates: boolean
      schema?: Schema<unknown>
    }
  }
  storage: {
    batchSize?: number
  }
}

export const ecsBaseMiddleware = <C>(
  clusterId: string,
  components: EcsBaseContext['components'],
): ContextExtensionMiddleware<C, EcsBaseContext> => {
  return async (_e, ctx, next) => {
    const c = ctx as Record<string, unknown>
    c.clusterId = clusterId
    c.components = components
    return await next(ctx as C & EcsBaseContext)
  }
}
