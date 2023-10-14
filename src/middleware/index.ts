import { Awaitable } from '../awaitable'

export type Middleware<
  TEvent = unknown,
  TResult = void,
  TContext = unknown,
  TBaseContext = TContext,
> = (
  event: TEvent,
  baseContext: TBaseContext,
  next: (context?: TContext) => Awaitable<TResult>,
) => Awaitable<TResult>
