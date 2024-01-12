import { EntityId } from '../entity'

export interface UpdateStorage {
  updates(
    cursor?: string,
  ): AsyncGenerator<{ entityId: EntityId; cursor: string }>
}
