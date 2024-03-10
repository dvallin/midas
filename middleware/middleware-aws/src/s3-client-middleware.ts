import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3'
import { ContextExtensionMiddleware, mutableContext } from 'middleware-core'

export type S3Context = { aws: { s3Client: S3Client } }
export const s3ClientMiddleware = <C>(
  config: S3ClientConfig,
): ContextExtensionMiddleware<C, S3Context> => {
  return async (ctx, next) => {
    const client = new S3Client(config)
    try {
      const nextContext = mutableContext.lens(
        ctx,
        'aws',
        (aws) => mutableContext.mutate(aws, 's3Client', client),
      )
      return await next(nextContext)
    } finally {
      client.destroy()
    }
  }
}
