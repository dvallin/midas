import { Middleware } from '.'

export const memoizeMiddleware = <C, B>(
  middleware: Middleware<C, B>,
): Middleware<C, B> => {
  let memoized: C | undefined = undefined
  return (context, next) => {
    if (!memoized) {
      return middleware(context, (c) => {
        memoized = c
        return next(c)
      })
    } else {
      return next(memoized)
    }
  }
}
