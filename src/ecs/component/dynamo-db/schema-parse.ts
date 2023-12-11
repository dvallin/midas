import { isSuccess, Schema } from '@spaceteams/zap'

export function parseThrowing<T>(schema: Schema<T>, value: unknown): T {
  const { parsedValue, validation } = schema.parse(value)
  if (isSuccess(validation) && parsedValue) {
    return parsedValue
  }
  throw validation
}
