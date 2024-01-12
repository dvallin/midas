import { EntityId } from '../entity'

export type BatchReadResult<T> = {
  [entityId: string]: {
    value?: T | null
    error?: Error
  }
}
export type BatchWrite<T> = { entityId: EntityId; component: T }
export type BatchWriteResult = {
  [entityId: string]: {
    cursor: string
    error?: Error
  }
}
export class BatchWriteError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
  }
}
export class ConditionalWriteError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
  }
}

export interface ComponentStorage<T> {
  read(entityId: EntityId): Promise<T | undefined | null>
  readOrThrow(entityId: EntityId): Promise<T>

  write(entityId: string, component: T): Promise<{ cursor: string }>
  conditionalWrite(
    entityId: EntityId,
    current: T,
    previous: T | undefined | null,
  ): Promise<{ cursor: string }>

  delete(entityId: string): Promise<{ cursor: string }>
  erase(entityId: string): Promise<void>

  batchRead(entityIds: EntityId[]): Promise<BatchReadResult<T>>
  batchWrite(writes: BatchWrite<T>[]): Promise<BatchWriteResult>
}
export type InferComponentType<T> = T extends ComponentStorage<infer I> ? I
  : never
