import { Awaitable } from './awaitable'
import { Middleware } from './middleware'

class Pipeline<TEvent, TContext, TBaseContext = TContext, TResult = never> {
  constructor(private readonly stack: Middleware[]) {}

  use<TNextResult, TNextContext = TContext>(
    middleware: Middleware<TEvent, TNextResult, TNextContext, TContext>,
  ): Pipeline<TEvent, TNextContext, TBaseContext, TNextResult | TResult> {
    return new Pipeline([...this.stack, middleware] as Middleware[])
  }

  build(): (event: TEvent, context: TBaseContext) => Awaitable<TResult> {
    return (event, context) => {
      const traverse = <TResult>(
        ctx: unknown,
        index: number,
      ): Awaitable<TResult> => {
        if (index < this.stack.length) {
          const currentMiddleware = this.stack[index]
          return currentMiddleware(event, ctx, (c) => traverse(c, index + 1))
        } else {
          throw new Error('no middleware left in pipeline.')
        }
      }
      return traverse(context, 0)
    }
  }

  run(event: TEvent, context: TBaseContext): Awaitable<TResult> {
    return this.build()(event, context)
  }
}

export function pipeline<TEvent, TContext = {}>() {
  return new Pipeline<TEvent, TContext>([])
}
