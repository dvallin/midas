import { expect, it } from 'vitest'
import { pipeline } from 'middleware-core'
import { s3ClientMiddleware } from './s3-client-middleware'

it('creates client', async () => {
  const run = pipeline()
    .use(s3ClientMiddleware({}))
    .build()
  const result = await run({})
  expect(result.aws.s3Client).toBeDefined()
})
