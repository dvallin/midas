import { ContextExtensionMiddleware, Middleware } from './middleware'

export * from './middleware'
export * from './pipeline'

export * as mutableContext from './mutable-context'
export * as immutableContext from './immutable-context'

export type ServiceMethod<In, Out, Context> = ContextExtensionMiddleware<
  In & Context,
  Out,
  unknown
>
export type Renderer<C, ViewModel> = Middleware<
  unknown,
  string,
  C & ViewModel
>
