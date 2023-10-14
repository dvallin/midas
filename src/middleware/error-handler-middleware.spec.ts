import { expect, it, vi } from 'vitest'
import pipeline from '../pipeline'
import { errorHandlerMiddleware } from './error-handler-middleware'

it('catches errors', async () => {
  const error = new Error('has thrown')
  const onError = vi.fn()
  const run = pipeline()
    .use(
      errorHandlerMiddleware((e) => {
        onError(e)
        return true
      }),
    )
    .use(() => {
      throw error
    })
    .build()
  await run({}, {})
  expect(onError).toHaveBeenCalledWith(error)
})

it('rethrows errors if handler returns false', () => {
  const error = new Error('has thrown')
  const run = pipeline()
    .use(errorHandlerMiddleware(() => false))
    .use(() => {
      throw error
    })
    .build()
  expect(run({}, {})).rejects.toBe(error)
})
