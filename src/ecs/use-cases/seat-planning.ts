import { array, InferType, object, string } from '@spaceteams/zap'
import { component, service } from '..'
import { expect, it } from 'vitest'

const SoldSeatSchema = object({
  userId: string(),
})
type SoldSeat = InferType<typeof SoldSeatSchema>

export const BasketSchema = object({ planId: string(), seats: array(string()) })
export type Basket = InferType<typeof BasketSchema>

type SeatPlanContext = {
  soldSeats: component.ComponentStorage<SoldSeat>

  reservedSeatOverview: component.SetStorage<string>
  soldSeatOverview: component.SetStorage<string>

  baskets: component.ComponentStorage<Basket>
  basketReleases: component.ScheduleStorage

  cursors: component.ComponentStorage<string>
}

async function reserveSeats(
  planId: string,
  seatIds: string[],
  user: string,
  context: SeatPlanContext,
) {
  await context.reservedSeatOverview.conditionalSetAdd(planId, ...seatIds)
  try {
    await context.baskets.readBeforeWriteUpdate(user, (basket) => ({
      planId,
      seats: [...seatIds, ...(basket?.seats ?? [])],
    }))
    await context.basketReleases.write(user, new Date())
  } catch {
    await context.reservedSeatOverview.setDelete(planId, ...seatIds)
  }
}

async function submitBasket(userId: string, context: SeatPlanContext) {
  const basket = await context.baskets.read(userId)
  if (basket) {
    await context.soldSeatOverview.setAdd(basket.planId, ...basket.seats)
    await context.soldSeats.batchWrite(
      basket.seats.map((entityId) => ({ entityId, component: { userId } })),
    )
  }
  await context.basketReleases.erase(userId)
  await context.baskets.erase(userId)
}

async function automaticReservedLockRelease(context: SeatPlanContext) {
  await new service.Updater({
    name: 'automaticLockRelease',
    cursors: context.cursors,
    updateStorage: context.basketReleases,
  }).runUpdate(async (userId) => {
    const basket = await context.baskets.read(userId)
    if (basket) {
      await context.reservedSeatOverview.setDelete(
        basket.planId,
        ...basket.seats,
      )
    }
    await context.basketReleases.erase(userId)
    await context.baskets.erase(userId)
  })
}

export default function (provider: () => SeatPlanContext) {
  it('reserves seats and buys them', async () => {
    const context = provider()

    await reserveSeats('plan-1', ['seat-1', 'seat-2'], 'user', context)
    await submitBasket('user', context)

    expect(await context.reservedSeatOverview.read('plan-1')).toEqual([
      'seat-1',
      'seat-2',
    ])
    expect(await context.soldSeatOverview.read('plan-1')).toEqual([
      'seat-1',
      'seat-2',
    ])
  })

  it('does not allow multiple reservations', async () => {
    const context = provider()

    await reserveSeats('plan-2', ['seat-1', 'seat-2'], 'user', context)

    expect(
      reserveSeats('plan-2', ['seat-2', 'seat-3'], 'user-2', context),
    ).rejects.toThrowError('conditional add failed')
  })

  it('releases reserved seats', async () => {
    const context = provider()

    await reserveSeats('plan-3', ['seat-1', 'seat-2'], 'user', context)
    await automaticReservedLockRelease(context)

    expect(await context.reservedSeatOverview.read('plan-3')).toEqual([])
  })
}
