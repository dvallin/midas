import { InMemoryComponentStorage } from '.'

import componentStorageSpec from '../component-storage-spec'
import productVariantsUsecase from '../../use-cases/product-variants'

componentStorageSpec(() => new InMemoryComponentStorage())
productVariantsUsecase(() => ({
  skus: new InMemoryComponentStorage(),
  variants: new InMemoryComponentStorage(),
  products: new InMemoryComponentStorage(),
  cursors: new InMemoryComponentStorage(),
}))
