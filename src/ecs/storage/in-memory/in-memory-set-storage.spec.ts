import { InMemorySetStorage } from './in-memory-set-storage'
import productCategoriesUsecase from '../../use-cases/product-categories'
import spec from '../set-storage-spec'
import { InMemoryComponentStorage } from '.'

spec(() => new InMemorySetStorage())
productCategoriesUsecase(() => ({
  categories: new InMemoryComponentStorage(),
  productToCategories: new InMemorySetStorage(),
  categoryToProducts: new InMemorySetStorage(),
}))
