import { describe, it } from 'vitest'
import { ArrayStorage, ComponentStorage } from '../storage'

type CartItem = {
  productId: string
  quantity: number
}
type Cart = {
  items: CartItem[]
}
type CartEvent =
  | {
    op: 'add'
    item: CartItem
  }
  | {
    op: 'remove'
    index: number
  }

export default function (
  provider: () => {
    carts: ComponentStorage<Cart>
    cartEvents: ArrayStorage<CartEvent>
  },
) {
  describe('simple shopping cart usecase', () => {
    it('uses read-before write', async () => {
      const { carts } = provider()

      carts.write('1', { items: [] })

      const cart = await carts.read('1')
      const updatedCart: Cart = {
        items: [...(cart?.items ?? []), { productId: 'product1', quantity: 1 }],
      }
      await carts.conditionalWrite('1', updatedCart, cart)
    })
  })
  describe('event-sourced shopping cart usecase', () => {
    it('works on naive event sourcing', async () => {
      const { carts, cartEvents } = provider()

      await carts.write('1', { items: [] })

      await cartEvents.push('1', {
        op: 'add',
        item: { productId: 'product1', quantity: 1 },
      })
      await cartEvents.push('1', {
        op: 'add',
        item: { productId: 'product2', quantity: 1 },
      })
      await cartEvents.push('1', {
        op: 'remove',
        index: 0,
      })

      const events = await cartEvents.read('1')
      let items: CartItem[] = []
      for (const event of events ?? []) {
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
