export interface ComponentStorage<T> {
  read(entityId: string): Promise<T | undefined>
  readOrThrow(entityId: string): Promise<T>
  write(entityId: string, component: T): Promise<void>
  conditionalWrite(
    entityId: string,
    current: T,
    previous: T | undefined,
  ): Promise<void>
  all(): AsyncGenerator<{
    entityId: string
    component: T
  }>
  updates(cursor: string): AsyncGenerator<{ entityId: string; cursor: string }>
  commitUpdateIndex(): Promise<void>
}
export type InferComponentType<T> = T extends ComponentStorage<infer I>
  ? I
  : never

export interface ArrayStorage<T> extends ComponentStorage<T[]> {
  push(entityId: string, component: T): Promise<void>
}
export interface SetStorage<T> extends ComponentStorage<T[]> {
  add(entityId: string, component: T): Promise<void>
  delete(entityId: string, component: T): Promise<void>
}
export interface KeyStorage extends ComponentStorage<string> {
  getByKey(key: string): Promise<string | undefined>
  getByKeyOrThrow(key: string): Promise<string>
}

export * from './in-memory'
export * from './dynamo-db'
