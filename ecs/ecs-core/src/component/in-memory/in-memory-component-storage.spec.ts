import { InMemoryComponentStorage, InMemoryUpdateStorage } from '.'

import componentStorageSpec from '../component-storage-spec'
import productVariantsUsecase, {
  Sku,
  Variant,
} from '../../use-cases/product-variants'

componentStorageSpec(() => {
  const updateStorage = new InMemoryUpdateStorage<string>()
  return { storage: updateStorage, updates: updateStorage }
})
productVariantsUsecase(() => {
  const skus = new InMemoryUpdateStorage<Sku>()
  const variants = new InMemoryUpdateStorage<Variant>()
  return {
    skus,
    skuUpdates: skus,
    variants,
    variantUpdates: variants,
    products: new InMemoryComponentStorage(),
    cursors: new InMemoryComponentStorage(),
  }
})
