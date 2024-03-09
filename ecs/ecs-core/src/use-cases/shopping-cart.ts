import { describe, it } from 'vitest'
import { component } from '..'
import {
  array,
  discriminatedUnion,
  InferType,
  literal,
  number,
  object,
  string,
} from '@spaceteams/zap'

export const CartItemSchema = object({
  productId: string(),
  quantity: number(),
})

export const CartSchema = object({
  items: array(CartItemSchema),
})

export const CartEventSchema = discriminatedUnion(
  'op',
  object({ op: literal('add'), item: CartItemSchema }),
  object({ op: literal('remove'), index: number() }),
)

export type Cart = InferType<typeof CartSchema>
export type CartItem = InferType<typeof CartItemSchema>
export type CartEvent = InferType<typeof CartEventSchema>

export default function (
  provider: () => {
    carts: component.ComponentStorage<Cart>
    cartEvents: component.ArrayStorage<CartEvent>
  },
) {
  describe('simple shopping cart usecase', () => {
    it('uses read-before write', async () => {
      const { carts } = provider()

      await new component.ReadBeforeWriteUpdate(carts).update('1', (cart) => ({
        items: [...(cart?.items ?? []), { productId: 'product1', quantity: 1 }],
      }))
    })
  })
  describe('event-sourced shopping cart usecase', () => {
    it('works on naive event sourcing', async () => {
      const { carts, cartEvents } = provider()

      await carts.write('1', { items: [] })

      await cartEvents.arrayPush('1', {
        op: 'add',
        item: { productId: 'product1', quantity: 1 },
      })
      await cartEvents.arrayPush('1', {
        op: 'add',
        item: { productId: 'product2', quantity: 1 },
      })
      await cartEvents.arrayPush('1', {
        op: 'remove',
        index: 0,
      })

      const events = await cartEvents.readOrThrow('1')
      let items: CartItem[] = []
      for (const event of events) {
        switch (event.op) {
          case 'add': {
            items.push(event.item)
            break
          }
          case 'remove': {
            items = items.slice(event.index, 1)
            break
          }
        }
      }
      await carts.write('1', { items })
    })
  })
}
