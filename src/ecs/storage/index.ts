export interface ComponentStorage<T> {
  read(entityId: string): Promise<T | undefined>
  readOrThrow(entityId: string): Promise<T>
  write(entityId: string, component: T): Promise<{ cursor: string }>
  conditionalWrite(
    entityId: string,
    current: T,
    previous: T | undefined,
  ): Promise<{ cursor: string }>
  updates(cursor?: string): AsyncGenerator<{ entityId: string; cursor: string }>
}
export type InferComponentType<T> = T extends ComponentStorage<infer I>
  ? I
  : never

export interface ArrayStorage<T> extends ComponentStorage<T[]> {
  push(entityId: string, component: T): Promise<{ cursor: string }>
}
export interface SetStorage<T> extends ComponentStorage<T[]> {
  add(entityId: string, component: T): Promise<{ cursor: string }>
  delete(entityId: string, component: T): Promise<{ cursor: string }>
}
export interface KeyStorage extends ComponentStorage<string> {
  getByKey(key: string): Promise<string | undefined>
  getByKeyOrThrow(key: string): Promise<string>
}

export * from './in-memory'
export * from './dynamo-db'
