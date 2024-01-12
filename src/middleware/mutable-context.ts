export function mutate<T, K extends string | number | symbol, V>(
  ctx: T,
  key: K,
  value: V,
): T & { [key in K]: V } {
  ctx[key as unknown as keyof T] = value as T[keyof T]
  return ctx as T & { [key in K]: V }
}

export function lens<T, K extends string, O>(
  ctx: T,
  key: K,
  mutator: (v: unknown) => O,
): T & { [key in K]: O } {
  const c = ctx as Record<string, unknown>
  if (!c[key]) {
    c[key] = {}
  }
  mutator(c[key])
  return ctx as T & { [key in K]: O }
}
