import { ContextExtensionMiddleware, mutableContext } from 'middleware-core'
import { Client, ClientOptions } from '@elastic/elasticsearch'

export type ElasticsearchEndpointContext = {
  elastic: { endpoint: string }
}
export const elasticsearchEndpointMiddleware = <C>(
  endpoint: string,
): ContextExtensionMiddleware<C, ElasticsearchEndpointContext> => {
  return async (ctx, next) => {
    const nextContext = mutableContext.lens(
      ctx,
      'elastic',
      (aws) => mutableContext.mutate(aws, 'endpoint', endpoint),
    )
    return await next(nextContext)
  }
}

export type ElasticsearchContext = {
  elastic: { client: Client }
}
export const elasticsearchMiddleware = <C extends ElasticsearchEndpointContext>(
  config: ClientOptions,
): ContextExtensionMiddleware<C, ElasticsearchContext> => {
  return async (ctx, next) => {
    const client = new Client({
      node: ctx.elastic.endpoint,
      headers: {
        'Content-Type': 'application/json',
      },
      ...config,
    })
    const c = ctx as { elastic?: Record<string, unknown> }
    if (!c.elastic) {
      c.elastic = {}
    }
    c.elastic.client = client
    return await next(ctx as C & ElasticsearchContext)
  }
}
