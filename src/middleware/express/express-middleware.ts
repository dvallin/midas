import { Request, Response } from 'express'
import { Middleware } from '..'
import { Pipeline } from '../../pipeline'

export type ExpressEvent = { req: Request; res: Response }
export type ExpressMiddleware<C> = Middleware<ExpressEvent, void, C>

export function toExpressHandler<C, ResBody = string>(
  pipeline: Pipeline<ExpressEvent, C, C, ResBody>,
  context: C,
) {
  return async (req: Request, res: Response) => {
    const response = await pipeline.run({ req, res }, { ...context })
    res.send(response)
  }
}
