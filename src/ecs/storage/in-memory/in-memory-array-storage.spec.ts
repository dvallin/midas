import { InMemoryArrayStorage } from './in-memory-array-storage'
import arrayStorageSpec from '../array-storage-spec'
import shoppingCartUsecase from '../../use-cases/shopping-cart'
import { InMemoryComponentStorage } from '.'

arrayStorageSpec(() => new InMemoryArrayStorage())
shoppingCartUsecase(() => ({
  carts: new InMemoryComponentStorage(),
  cartEvents: new InMemoryArrayStorage(),
}))
