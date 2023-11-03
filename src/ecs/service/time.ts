export class Time {
  get now(): number {
    return performance.timeOrigin + performance.now()
  }
}
