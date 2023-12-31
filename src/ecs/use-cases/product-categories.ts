import { describe, expect, it } from 'vitest'
import { component, service } from '..'

export type Category = {
  parent?: string
  name: string
}
export default function (
  provider: () => {
    categories: component.ComponentStorage<Category>
    productToCategories: component.SetStorage<string>
    categoryToProducts: component.SetStorage<string>
  },
) {
  describe('product-categories-usecase', () => {
    it('fetches products of each category', async () => {
      // given
      const { productToCategories, categoryToProducts } = provider()

      const linker = new service.Linker(productToCategories, categoryToProducts)
      await linker.link('1', 'cat-1')
      await linker.link('2', 'cat-1')
      await linker.link('2', 'cat-2')

      expect(await productToCategories.read('1')).toEqual(['cat-1'])
      expect(await productToCategories.read('2')).toEqual(
        expect.arrayContaining(['cat-1', 'cat-2']),
      )
      expect(await categoryToProducts.read('cat-1')).toEqual(
        expect.arrayContaining(['1', '2']),
      )
      expect(await categoryToProducts.read('cat-2')).toEqual(['2'])
    })
    it('removes products from categories', async () => {
      // given
      const { productToCategories, categoryToProducts } = provider()

      const linker = new service.Linker(productToCategories, categoryToProducts)
      await linker.link('1', 'cat-1')
      await linker.unlink('1', 'cat-1')

      expect(await productToCategories.read('1')).toEqual([])
    })

    it('fetches products of each sub-category', async () => {
      // given
      const { categories, productToCategories, categoryToProducts } = provider()

      await categories.write('cat-1', {
        name: 'cat-1',
      })
      await categories.write('cat-2', {
        parent: 'cat-1',
        name: 'cat-2',
      })
      await categories.write('cat-3', {
        parent: 'cat-2',
        name: 'cat-3',
      })

      const linker = new service.TreeLinker(
        categories,
        new service.Linker(productToCategories, categoryToProducts),
      )
      await linker.link('1', 'cat-1')
      await linker.link('2', 'cat-3')

      expect(await productToCategories.read('1')).toEqual(['cat-1'])
      expect(await productToCategories.read('2')).toEqual(
        expect.arrayContaining(['cat-1', 'cat-2', 'cat-3']),
      )
      expect(await categoryToProducts.read('cat-1')).toEqual(
        expect.arrayContaining(['1', '2']),
      )
      expect(await categoryToProducts.read('cat-2')).toEqual(['2'])
      expect(await categoryToProducts.read('cat-3')).toEqual(['2'])
    })
    // TODO: removing products from subcategories. Could be implemented using reference counting.
  })
}
