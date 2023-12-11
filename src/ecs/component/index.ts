import { EntityId } from '../entity'

export type BatchReadResult<T> = {
  [entityId: string]: {
    value?: T
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
export interface ComponentStorage<T> {
  read(entityId: EntityId): Promise<T | undefined>
  readOrThrow(entityId: EntityId): Promise<T>

  write(entityId: string, component: T): Promise<{ cursor: string }>
  conditionalWrite(
    entityId: EntityId,
    current: T,
    previous: T | undefined,
  ): Promise<{ cursor: string }>

  batchRead(entityIds: EntityId[]): Promise<BatchReadResult<T>>
  batchWrite(writes: BatchWrite<T>[]): Promise<BatchWriteResult>
}
export type InferComponentType<T> = T extends ComponentStorage<infer I> ? I
  : never

export interface UpdateStorage {
  updates(
    cursor?: string,
  ): AsyncGenerator<{ entityId: EntityId; cursor: string }>
}

export interface ArrayStorage<T> extends ComponentStorage<T[]> {
  push(entityId: EntityId, component: T): Promise<{ cursor: string }>
  remove(entityId: string, index: number): Promise<{ cursor: string }>
}

export interface SetStorage<T> extends ComponentStorage<T[]> {
  add(entityId: EntityId, component: T): Promise<{ cursor: string }>
  conditionalAdd(entityId: EntityId, component: T): Promise<{ cursor: string }>
  delete(entityId: EntityId, component: T): Promise<{ cursor: string }>
  conditionalDelete(
    entityId: EntityId,
    component: T,
  ): Promise<{ cursor: string }>
}

export interface KeyStorage extends ComponentStorage<string> {
  getByKey(key: string): Promise<EntityId | undefined>
  getByKeyOrThrow(key: string): Promise<EntityId>
}

export * from './in-memory'
export * from './dynamo-db'
export * from './elastic'
