import {
  CreateElasticsearchDomainCommand,
  DescribeElasticsearchDomainCommand,
  ElasticsearchServiceClient,
  ElasticsearchServiceClientConfig,
  ListDomainNamesCommand,
} from '@aws-sdk/client-elasticsearch-service'
import { ContextExtensionMiddleware } from '..'
import { ElasticsearchEndpointContext } from '../elasticsearch/elasticsearch-middleware'

export type ElasticsearchServiceContext = {
  aws: {
    elasticsearchServiceClient: ElasticsearchServiceClient
  }
}
export const elasticsearchServiceMiddleware = <C>(
  config: ElasticsearchServiceClientConfig,
): ContextExtensionMiddleware<C, ElasticsearchServiceContext> => {
  return async (_e, ctx, next) => {
    const client = new ElasticsearchServiceClient(config)
    const c = ctx as { aws?: Record<string, unknown> }
    try {
      if (!c.aws) {
        c.aws = {}
      }
      c.aws.elasticsearchServiceClient = client
      return await next(c as C & ElasticsearchServiceContext)
    } finally {
      client.destroy()
    }
  }
}

export const elasticsearchDomainMiddleware = <
  C extends ElasticsearchServiceContext,
>(
  domainName: string,
): ContextExtensionMiddleware<C, ElasticsearchEndpointContext> => {
  return async (_e, ctx, next) => {
    const domainNames = await ctx.aws.elasticsearchServiceClient.send(
      new ListDomainNamesCommand({}),
    )
    const alreadyExists = domainNames.DomainNames?.map(
      (d) => d.DomainName,
    ).includes(domainName)

    let endpoint
    if (alreadyExists) {
      const result = await ctx.aws.elasticsearchServiceClient.send(
        new DescribeElasticsearchDomainCommand({
          DomainName: domainName,
        }),
      )
      endpoint = result.DomainStatus?.Endpoint
    } else {
      const result = await ctx.aws.elasticsearchServiceClient.send(
        new CreateElasticsearchDomainCommand({
          DomainName: domainName,
        }),
      )
      endpoint = result.DomainStatus?.Endpoint
    }

    if (endpoint === undefined) {
      throw new Error('could not create elastic search endpoint for domain')
    }

    const c = ctx as { aws?: Record<string, unknown> }
    if (!c.aws) {
      c.aws = {}
    }
    c.aws.elasticsearchEndpoint = endpoint
    return await next(c as C & ElasticsearchEndpointContext)
  }
}
