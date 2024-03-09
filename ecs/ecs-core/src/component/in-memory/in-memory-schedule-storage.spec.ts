import scheduleStorageSpec from '../schedule-storage-spec'
import locking from '../../use-cases/locking'
import seatPlanning from '../../use-cases/seat-planning'
import {
  InMemoryComponentStorage,
  InMemoryScheduleStorage,
  InMemorySetStorage,
} from '../in-memory'

scheduleStorageSpec(() => ({
  storage: new InMemoryComponentStorage(),
  schedules: new InMemoryScheduleStorage(),
}))

locking(() => ({
  locks: new InMemoryComponentStorage(),
  lockReleases: new InMemoryScheduleStorage(),
  cursors: new InMemoryComponentStorage(),
}))

seatPlanning(() => ({
  soldSeatOverview: new InMemorySetStorage(),
  reservedSeatOverview: new InMemorySetStorage(),
  baskets: new InMemoryComponentStorage(),
  basketReleases: new InMemoryScheduleStorage(),
  soldSeats: new InMemoryComponentStorage(),
  cursors: new InMemoryComponentStorage(),
}))
