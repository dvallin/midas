import { Request, Response } from 'express'
import {
  ContextExtensionMiddleware,
  Middleware,
  Pipeline,
} from '../../middleware-core'

export type ExpressEvent = { req: Request; res: Response }
export type ExpressMiddleware<C> = Middleware<ExpressEvent, void, C>
export type ExpressRequestParser<C, Out> = ContextExtensionMiddleware<
  C,
  Out,
  ExpressEvent
>

export function toExpressHandler<C, ResBody = string>(
  pipeline: Pipeline<ExpressEvent, C, C, ResBody>,
  context: C,
) {
  return async (req: Request, res: Response) => {
    const response = await pipeline.run({ req, res }, { ...context })
    res.send(response)
  }
}
