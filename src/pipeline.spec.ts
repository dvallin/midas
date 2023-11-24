import { expect, it } from 'vitest'
import { pipeline } from './pipeline'

it('returns value', () => {
  const handler = pipeline()
    .use(() => 1)
    .build()
  expect(handler({}, {})).toEqual(1)
})

it('returns promise', () => {
  const handler = pipeline()
    .use(() => Promise.resolve(1))
    .build()
  expect(handler({}, {})).resolves.toEqual(1)
})

it('throws errors', () => {
  const handler = pipeline()
    .use(() => Promise.reject(1))
    .build()
  expect(handler({}, {})).rejects.toEqual(1)
})

it('allows errors to be handled upstream', async () => {
  const handler = pipeline()
    .use(async (_e, ctx, next) => {
      try {
        return await next(ctx)
      } catch (_e) {
        return 'handled'
      }
    })
    .use((_e, ctx, next) => next(ctx))
    .use(() => Promise.reject(1))
    .build()
  const result = await handler({}, {})
  expect(result).toEqual('handled')
})

it('supports conditional returns', () => {
  const handler = pipeline<{ condition: boolean }>()
    .use(({ condition }, ctx, next) => (condition ? 1 : next(ctx)))
    .use(() => '2')
    .build()

  expect(handler({ condition: true }, {})).toEqual(1)
  expect(handler({ condition: false }, {})).toEqual('2')
})
