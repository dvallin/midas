import {
  ElasticsearchServiceClient,
  ElasticsearchServiceClientConfig,
} from '@aws-sdk/client-elasticsearch-service'
import { ContextExtensionMiddleware } from '..'

export type ElasticsearchContext = {
  aws: { elasticSearchServiceClient: ElasticsearchServiceClient }
}
export const elasticSearchClientMiddleware = <
  C extends { aws?: Record<string, unknown> },
>(
  config: ElasticsearchServiceClientConfig,
): ContextExtensionMiddleware<C, ElasticsearchContext> => {
  return async (_e, ctx, next) => {
    const client = new ElasticsearchServiceClient(config)
    try {
      if (!ctx.aws) {
        ctx.aws = {}
      }
      ctx.aws.elasticSearchServiceClient = client
      return await next(ctx as C & ElasticsearchContext)
    } finally {
      client.destroy()
    }
  }
}
