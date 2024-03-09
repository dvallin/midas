import { expect, it } from 'vitest'
import { pipeline } from '../pipeline'
import { awaitMiddleware } from './await-middleware'

it('awaits one promise', async () => {
  type Context = { a: Promise<string>; b: Promise<string> }
  const run = pipeline<unknown, Context>()
    .use(awaitMiddleware('a'))
    .use((_e, c) => c)
    .build()
  const result = await run(
    {},
    { a: Promise.resolve('a'), b: Promise.resolve('b') },
  )
  expect(result).toEqual({ a: 'a', b: Promise.resolve('b') })
})

it('awaits multiple promises', async () => {
  type Context = { a: Promise<string>; b: Promise<string>; c: Promise<string> }
  const run = pipeline<unknown, Context>()
    .use(awaitMiddleware('a'))
    .use(awaitMiddleware('b', 'c'))
    .use((_e, c) => c)
    .build()
  const result = await run(
    {},
    {
      a: Promise.resolve('a'),
      b: Promise.resolve('b'),
      c: Promise.resolve('c'),
    },
  )
  expect(result).toEqual({ a: 'a', b: 'b', c: 'c' })
})

it('works with non-promises', async () => {
  const run = pipeline<unknown, { a: string }>()
    .use(awaitMiddleware('a'))
    .use((_e, c) => c)
    .build()
  const result = await run({}, { a: 'a' })
  expect(result).toEqual({ a: 'a' })
})
