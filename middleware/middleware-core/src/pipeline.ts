import { Awaitable } from './awaitable'
import { Middleware } from './middleware'

export class Pipeline<
  TContext,
  TBaseContext = TContext,
> {
  constructor(private readonly stack: Middleware[]) {}

  use<TNextContext>(
    middleware: Middleware<TNextContext, TContext>,
  ): Pipeline<TNextContext, TBaseContext> {
    return new Pipeline([...this.stack, middleware] as Middleware[])
  }

  build(): (context: TBaseContext) => Awaitable<TContext> {
    return (context) => {
      const traverse = <TContext>(
        ctx: unknown,
        index: number,
      ): Awaitable<TContext> => {
        if (index < this.stack.length) {
          const currentMiddleware = this.stack[index]
          return currentMiddleware(
            ctx,
            (c) => traverse(c, index + 1),
          ) as Awaitable<TContext>
        } else {
          return ctx as Awaitable<TContext>
        }
      }
      return traverse(context, 0)
    }
  }

  run(context: TBaseContext): Awaitable<TContext> {
    return this.build()(context)
  }
}

export function pipeline<TContext = Record<string, unknown>>() {
  return new Pipeline<TContext>([])
}
