import { ContextExtensionMiddleware } from '../../../../middleware/middleware-core'

export class Time {
  get now(): number {
    return performance.timeOrigin + performance.now()
  }
}

export type TimeContext = {
  service: {
    time: Time
  }
}

export const timeMiddleware = <C>(
  instance: Time = new Time(),
): ContextExtensionMiddleware<C, TimeContext> => {
  return async (ctx, next) => {
    const c = ctx as { service?: Record<string, unknown> }
    if (!c.service) {
      c.service = {}
    }
    c.service.time = instance
    return await next(ctx as C & TimeContext)
  }
}

export class MockTime extends Time {
  private mockNow: number | undefined

  public setMockNow(value: number | Date): void {
    this.mockNow = value.valueOf()
  }
  public resetMock(): void {
    this.mockNow = undefined
  }

  get now(): number {
    if (this.mockNow) {
      return this.mockNow
    }
    return super.now
  }
}
