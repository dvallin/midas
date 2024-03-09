import { ContextMappingMiddleware } from '.'

export const awaitMiddleware = <C, K extends keyof C>(
  ...keys: K[]
): ContextMappingMiddleware<
  C,
  & {
    [key in K]: Awaited<C[key]>
  }
  & {
    [key in Exclude<keyof C, K>]: C[key]
  }
> =>
async (_e, context, next) => {
  for (const key of keys) {
    const value = context[key]
    if (value instanceof Promise) {
      context[key] = await value
    }
  }

  return next(
    context as
      & {
        [key in K]: Awaited<C[key]>
      }
      & {
        [key in Exclude<keyof C, K>]: C[key]
      },
  )
}
