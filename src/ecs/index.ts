import { Schema } from '@spaceteams/zap'
import { ContextExtensionMiddleware } from '../middleware'

export * from './service'
export * from './storage'

export type EcsBaseContext = {
  clusterId: string
  components: {
    [name: string]: {
      type: 'key' | 'set' | 'array' | 'default'
      tracksUpdates: boolean
      schema?: Schema<unknown>
    }
  }
}

export const ecsBaseMiddleware = <C extends Record<string, unknown>>(
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
