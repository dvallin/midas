import { EntityId } from '../entity'
import { ComponentStorage } from './component-storage'
import { UpdateStorage } from './update-storage'

export interface ScheduleStorage extends UpdateStorage, ComponentStorage<Date> {
  schedules(
    startDate?: Date,
  ): AsyncGenerator<{ entityId: EntityId; cursor: string }>
}
