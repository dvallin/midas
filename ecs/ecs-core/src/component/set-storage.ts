import { EntityId } from '../entity'
import { ComponentStorage } from './component-storage'

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
