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
export interface ComponentStorage<T> {
  read(entityId: EntityId): Promise<T | undefined | null>
  readOrThrow(entityId: EntityId): Promise<T>

  write(entityId: string, component: T): Promise<{ cursor: string }>
  conditionalWrite(
    entityId: EntityId,
    current: T,
    previous: T | undefined | null,
  ): Promise<{ cursor: string }>

  readBeforeWriteUpdate(
    entityId: EntityId,
    updater: (previous: T | undefined | null) => T,
  ): Promise<{ cursor: string }>

  delete(entityId: string): Promise<{ cursor: string }>
  erase(entityId: string): Promise<void>

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

export interface ScheduleStorage extends UpdateStorage, ComponentStorage<Date> {
  schedules(
    startDate?: Date,
  ): AsyncGenerator<{ entityId: EntityId; cursor: string }>
}

export interface ArrayStorage<T> extends ComponentStorage<T[]> {
  arrayPush(entityId: EntityId, component: T): Promise<{ cursor: string }>
  arrayRemove(entityId: string, index: number): Promise<{ cursor: string }>
}

export interface SetStorage<T> extends ComponentStorage<T[]> {
  setAdd(entityId: EntityId, ...component: T[]): Promise<{ cursor: string }>
  conditionalSetAdd(
    entityId: EntityId,
    ...component: T[]
  ): Promise<{ cursor: string }>
  setDelete(entityId: EntityId, ...component: T[]): Promise<{ cursor: string }>
  conditionalSetDelete(
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
