import { isSuccess, Schema } from '@spaceteams/zap'

export function parseThrowing<T>(
  schema: Schema<unknown, T>,
  value: unknown,
): T {
  const { parsedValue, validation } = schema.parse(value)
  if (isSuccess(validation) && parsedValue) {
    return parsedValue
  }
  throw validation
}

export function validateThrowing<T>(
  schema: Schema<T>,
  value: unknown,
): value is T {
  const validation = schema.validate(value)
  if (isSuccess(validation)) {
    return true
  }
  throw validation
}
