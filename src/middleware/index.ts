import { Awaitable } from '../awaitable'

export type Middleware<
  TEvent = unknown,
  TResult = never,
  TContext = unknown,
  TBaseContext = TContext,
> = (
  event: TEvent,
  baseContext: TBaseContext,
  next: (context: TContext) => Awaitable<never>,
) => Awaitable<TResult>

export type ContextMappingMiddleware<
  TBaseContext,
  TContext,
  TEvent = unknown,
  TResult = never,
> = Middleware<TEvent, TResult, TContext, TBaseContext>
export type ContextExtensionMiddleware<
  TBaseContext,
  TContext,
  TEvent = unknown,
  TResult = never,
> = Middleware<TEvent, TResult, TBaseContext & TContext, TBaseContext>

export * from './await-middleware'
export * from './aws'
