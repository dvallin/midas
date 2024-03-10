import { Awaitable } from '../awaitable'

export type Middleware<
  TContext = unknown,
  TBaseContext = TContext,
> = (
  baseContext: TBaseContext,
  next: (context: TContext) => Awaitable<never>,
) => Awaitable<TContext>

export type ContextMappingMiddleware<
  TBaseContext,
  TContext,
> = Middleware<TContext, TBaseContext>
export type ContextExtensionMiddleware<
  TBaseContext,
  TContext,
> = Middleware<TBaseContext & TContext, TBaseContext>

export * from './await-middleware'
export * from './memoize-middleware'
