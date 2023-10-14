export function memoize<T>(provider: () => T): () => T {
  let val: T | undefined = undefined
  return () => {
    if (val === undefined) {
      val = provider()
    }
    return val
  }
}
