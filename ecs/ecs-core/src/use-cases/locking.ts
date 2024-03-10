import { InferType, object, string } from '@spaceteams/zap'
import { expect, it } from 'vitest'
import { ComponentStorage, ScheduleStorage } from '../component'
import { EntityId } from '../entity'
import { Updater } from '../service'

export const LockSchema = object({ user: string() })
export type Lock = InferType<typeof LockSchema>

type LockingContext = {
  locks: ComponentStorage<Lock>
  lockReleases: ScheduleStorage
  cursors: ComponentStorage<string>
}

export async function getLock(
  entityId: EntityId,
  user: string,
  { locks, lockReleases }: Pick<LockingContext, 'locks' | 'lockReleases'>,
) {
  await locks.conditionalWrite(entityId, { user }, undefined)
  await lockReleases.write(entityId, new Date())
}

export async function hasLock(
  entityId: EntityId,
  user: string,
  { locks }: Pick<LockingContext, 'locks'>,
) {
  const lock = await locks.read(entityId)
  return !!lock && lock.user === user
}

export async function releaseLock(
  entityId: EntityId,
  { locks, lockReleases }: Pick<LockingContext, 'locks' | 'lockReleases'>,
) {
  await lockReleases.erase(entityId)
  await locks.erase(entityId)
}

async function releaseLockOfUser(
  entityId: EntityId,
  user: string,
  context: Pick<LockingContext, 'locks' | 'lockReleases'>,
) {
  const userHasLock = await hasLock(entityId, user, context)
  if (userHasLock) {
    await releaseLock(entityId, context)
  }
}

export async function automaticLockRelease(context: LockingContext) {
  await new Updater({
    name: 'automaticLockRelease',
    cursors: context.cursors,
    updateStorage: context.lockReleases,
  }).runUpdate((entityId) => releaseLock(entityId, context))
}

export default function (provider: () => LockingContext) {
  it('gets lock and releases lock', async () => {
    const context = provider()
    await getLock('document-1', 'user-1', context)
    expect(await hasLock('document-1', 'user-1', context)).toEqual(true)

    await releaseLockOfUser('document-1', 'user-1', context)
    expect(await hasLock('document-1', 'user-1', context)).toEqual(false)
  })
  it('cannot get existing lock', async () => {
    const context = provider()
    await getLock('document-2', 'user-1', context)
    expect(getLock('document-2', 'user-2', context)).rejects.toThrowError(
      'conditional write failed',
    )
  })
  it('can get lock again after it has been released', async () => {
    const context = provider()
    await getLock('document-3', 'user-1', context)
    await releaseLockOfUser('document-3', 'user-1', context)
    await getLock('document-3', 'user-1', context)

    expect(await hasLock('document-3', 'user-1', context)).toEqual(true)
  })
  it('unlocks automatically', async () => {
    const context = provider()
    await getLock('document-4', 'user-1', context)
    await automaticLockRelease(context)
    expect(await hasLock('document-4', 'user-1', context)).toEqual(false)
  })
}
