import { Middleware } from '.'

export function contextMixinMiddleware<TContext, TBaseContext>(
  fn: (context: TBaseContext) => TContext,
): Middleware<unknown, never, TContext & TBaseContext, TBaseContext> {
  return (_event, context, next) => next({ ...context, ...fn(context) })
}
