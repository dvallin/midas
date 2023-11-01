export interface ComponentStorage<T> {
  read(entity: string): Promise<T | undefined>
  write(entity: string, component: T): Promise<void>
  conditionalWrite(
    entity: string,
    current: T,
    previous: T | undefined,
  ): Promise<void>
  updates(
    startDate: Date,
  ): AsyncGenerator<{ entityId: string; lastModified: Date }>
}

export interface ArrayStorage<T> extends ComponentStorage<T[]> {
  push(entity: string, component: T): Promise<void>
}
export interface SetStorage<T> extends ComponentStorage<T[]> {
  add(entity: string, component: T): Promise<void>
  delete(entity: string, component: T): Promise<void>
}

export * from './in-memory'
