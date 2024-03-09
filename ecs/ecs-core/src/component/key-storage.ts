import { EntityId } from '../entity'
import { ComponentStorage } from './component-storage'

export interface KeyStorage extends ComponentStorage<string> {
  getByKey(key: string): Promise<EntityId | undefined>
  getByKeyOrThrow(key: string): Promise<EntityId>
}
