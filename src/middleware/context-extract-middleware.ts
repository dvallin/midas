import { Middleware } from '.'

export const contextExtractMiddleware =
  <C>(): Middleware<unknown, C, never, C> => (_e, ctx) => ctx
