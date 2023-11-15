import { ContextExtensionMiddleware } from '..'
import { Client, ClientOptions } from '@elastic/elasticsearch'

export type ElasticsearchEndpointContext = {
  aws: {
    elasticsearchEndpoint: string
  }
}
export const elasticsearchEndpointMiddleware = <C>(
  endpoint: string,
): ContextExtensionMiddleware<C, ElasticsearchEndpointContext> => {
  return async (_e, ctx, next) => {
    const c = ctx as { aws?: Record<string, unknown> }
    if (!c.aws) {
      c.aws = {}
    }
    c.aws.elasticsearchEndpoint = endpoint
    return await next(c as C & ElasticsearchEndpointContext)
  }
}

export type ElasticsearchContext = {
  elastic: { client: Client }
}
export const elasticsearchMiddleware = <C extends ElasticsearchEndpointContext>(
  config: ClientOptions,
): ContextExtensionMiddleware<C, ElasticsearchContext> => {
  return async (_e, ctx, next) => {
    const client = new Client({
      node: ctx.aws.elasticsearchEndpoint,
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
