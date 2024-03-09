import { EntityId } from '../entity'
import { ComponentStorage } from './component-storage'

export interface ArrayStorage<T> extends ComponentStorage<T[]> {
  arrayPush(entityId: EntityId, component: T): Promise<{ cursor: string }>
  arrayRemove(entityId: string, index: number): Promise<{ cursor: string }>
}
