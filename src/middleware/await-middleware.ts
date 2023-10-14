import { Middleware } from '.'

export type AwaitedRecord<C> = {
  [key in keyof C]: Awaited<C[key]>
}
export type AwaitedContext<
  TBaseContext,
  K extends keyof TBaseContext,
> = AwaitedRecord<Pick<TBaseContext, K>>

export const awaitMiddleware = <C, K extends keyof C>(
  ...keys: K[]
): Middleware<unknown, unknown, AwaitedContext<C, K>, C> =>
async (_e, c, next) => {
  const subset: Partial<C> = {}

  for (const key of keys) {
    const value = c[key]
    if (value instanceof Promise) {
      subset[key] = await value
    } else {
      subset[key] = value
    }
  }

  return next(subset as AwaitedContext<C, K>)
}
