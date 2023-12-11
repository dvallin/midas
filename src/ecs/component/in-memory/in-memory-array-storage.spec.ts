import { InMemoryArrayStorage, InMemoryComponentStorage } from '.'

import arrayStorageSpec from '../array-storage-spec'
import shoppingCartUsecase from '../../use-cases/shopping-cart'

arrayStorageSpec(() => new InMemoryArrayStorage())
shoppingCartUsecase(() => ({
  carts: new InMemoryComponentStorage(),
  cartEvents: new InMemoryArrayStorage(),
}))
