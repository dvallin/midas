import { Awaitable } from './awaitable'
import { Middleware } from './middleware'

class Pipeline<TEvent, TResult, TContext, TBaseContext = TContext> {
  constructor(private readonly stack: Middleware[]) {}

  use<TNextContext, TNextResult = TResult>(
    middleware: Middleware<TEvent, TNextResult, TNextContext, TContext>,
  ): Pipeline<
    TEvent,
    TNextResult,
    Omit<TContext, keyof TNextContext> & TNextContext,
    TBaseContext
  > {
    return new Pipeline([...this.stack, middleware] as Middleware[])
  }

  build(): (event: TEvent, context: TBaseContext) => Awaitable<TResult> {
    function traverse<TEvent, TContext, TResult>(
      event: TEvent,
      context: TContext,
      stack: Middleware[],
    ): Awaitable<TResult> {
      const [head, ...tail] = stack
      return head(event, context as object, (c) => {
        if (tail.length > 0) {
          return traverse(
            event,
            c !== undefined ? { ...context, ...c } : context,
            tail,
          )
        }
        throw new Error('no middleware left in pipeline.')
      }) as Awaitable<TResult>
    }
    return (event, context) => traverse(event, context, this.stack)
  }
}

export default function pipeline<
  TEvent,
  TResult = unknown,
  TContext = unknown,
>() {
  return new Pipeline<TEvent, TResult, TContext>([])
}
