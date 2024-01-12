import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3'
import { ContextExtensionMiddleware } from '..'
import { lens, mutate } from '../mutable-context'

export type S3Context = { aws: { s3Client: S3Client } }
export const s3ClientMiddleware = <C>(
  config: S3ClientConfig,
): ContextExtensionMiddleware<C, S3Context> => {
  return async (_e, ctx, next) => {
    const client = new S3Client(config)
    try {
      const nextContext = lens(
        ctx,
        'aws',
        (aws) => mutate(aws, 's3Client', client),
      )
      return await next(nextContext)
    } finally {
      client.destroy()
    }
  }
}
