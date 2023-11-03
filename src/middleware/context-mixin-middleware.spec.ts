import { expect, it } from 'vitest'
import { pipeline } from '../pipeline'
import { contextMixinMiddleware } from './context-mixin-middleware'

it('maps multiple contexts', async () => {
  const handler = pipeline()
    .use(contextMixinMiddleware((_c) => ({ value: 'Value' })))
    .use(contextMixinMiddleware((c) => ({ otherValue: `other${c.value}` })))
    .use((_e, ctx) =>
      Promise.resolve({ value: ctx.value, otherValue: ctx.otherValue })
    )
    .build()
  const result = await handler({}, {})
  expect(result).toEqual({ value: 'Value', otherValue: 'otherValue' })
})
