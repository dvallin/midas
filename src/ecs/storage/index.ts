export interface ComponentStorage<T> {
  read(entityId: string): Promise<T | undefined>
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

export interface ArrayStorage<T> extends ComponentStorage<T[]> {
  push(entityId: string, component: T): Promise<void>
}
export interface SetStorage<T> extends ComponentStorage<T[]> {
  add(entityId: string, component: T): Promise<void>
  delete(entityId: string, component: T): Promise<void>
}

export * from './in-memory'
