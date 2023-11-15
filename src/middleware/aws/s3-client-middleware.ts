import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3'
import { ContextExtensionMiddleware } from '..'

export type S3Context = { aws: { s3Client: S3Client } }
export const s3ClientMiddleware = <C>(
  config: S3ClientConfig,
): ContextExtensionMiddleware<C, S3Context> => {
  return async (_e, ctx, next) => {
    const client = new S3Client(config)
    const c = ctx as { aws?: Record<string, unknown> }
    try {
      if (!c.aws) {
        c.aws = {}
      }
      c.aws.s3Client = client
      return await next(ctx as C & S3Context)
    } finally {
      client.destroy()
    }
  }
}
