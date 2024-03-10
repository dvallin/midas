import { Request, Response } from 'express'
import {
  ContextExtensionMiddleware,
  Middleware,
  Pipeline,
} from '../../middleware-core'

export type ExpressEvent = { req: Request; res: Response }
export type ExpressMiddleware<C extends ExpressEvent> = Middleware<C>
export type ExpressRequestParser<C extends ExpressEvent, Out> =
  ContextExtensionMiddleware<
    C,
    Out
  >

export function toExpressHandler<C, ResBody = string>(
  pipeline: Pipeline<ResBody, C & ExpressEvent>,
  context: C,
) {
  return async (req: Request, res: Response) => {
    const response = await pipeline.run({ req, res, ...context })
    res.send(response)
  }
}
