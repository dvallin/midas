import { InMemorySetStorage } from './in-memory-set-storage'
import productCategoriesUsecase from '../../use-cases/product-categories'
import { InMemoryComponentStorage } from '.'

productCategoriesUsecase(() => ({
  categories: new InMemoryComponentStorage(),
  productToCategories: new InMemorySetStorage(),
  categoryToProducts: new InMemorySetStorage(),
}))
