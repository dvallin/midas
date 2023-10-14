import { Middleware } from '.'

export const errorHandlerMiddleware = <C>(
  onError: (e: unknown, c: C) => boolean,
): Middleware<unknown, unknown, C> =>
async (_e, c, next) => {
  try {
    await next()
  } catch (e) {
    if (!onError(e, c)) {
      throw e
    }
  }
}
