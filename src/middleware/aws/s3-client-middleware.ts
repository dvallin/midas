import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3'
import { ContextExtensionMiddleware } from '..'

export const s3ClientMiddleware = <C extends { aws?: Record<string, unknown> }>(
  config: S3ClientConfig,
): ContextExtensionMiddleware<C, { aws: { s3Client: S3Client } }> => {
  return async (_e, ctx, next) => {
    const client = new S3Client(config)
    try {
      if (!ctx.aws) {
        ctx.aws = {}
      }
      ctx.aws.s3Client = client
      return await next(ctx as C & { aws: { s3Client: S3Client } })
    } finally {
      client.destroy()
    }
  }
}
