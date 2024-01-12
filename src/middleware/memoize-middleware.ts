import { Middleware } from '.'

export const memoizeMiddleware = <E, R, C, B>(
  middleware: Middleware<E, R, C, B>,
): Middleware<E, R, C, B> => {
  let memoized: C | undefined = undefined
  return (e, context, next) => {
    if (!memoized) {
      return middleware(e, context, (c) => {
        memoized = c
        return next(c)
      })
    } else {
      return next(memoized)
    }
  }
}
