import { describe, expect, it } from 'vitest'
import { ComponentStorage, SetStorage } from '../storage'

export type Category = {
  parent?: string
  name: string
}

class Linker {
  constructor(
    private readonly from: SetStorage<string>,
    private readonly to: SetStorage<string>,
  ) {}

  async link(from: string, to: string, bidirectional = false): Promise<void> {
    this.from.add(from, to)
    if (bidirectional) {
      this.to.add(to, from)
    }
  }
}

export default function (
  provider: () => {
    categories: ComponentStorage<Category>
    productToCategories: SetStorage<string>
    categoryToProducts: SetStorage<string>
  },
) {
  describe('product-categories-usecase', () => {
    it('fetches products of each category', async () => {
      // given
      const { categories, productToCategories, categoryToProducts } = provider()

      await categories.write('cat-1', {
        name: 'cat-1',
      })
      await categories.write('cat-1', {
        name: 'cat-2',
      })

      const linker = new Linker(productToCategories, categoryToProducts)
      await linker.link('1', 'cat-1')
      await linker.link('1', 'cat-2')
      await linker.link('2', 'cat-2')

      expect(await productToCategories.read('1')).toEqual(['cat-1', 'cat-2'])
      expect(await productToCategories.read('2')).toEqual(['cat-2'])
    })
  })
}
