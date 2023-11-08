import { InMemoryComponentStorage, InMemoryKeyStorage } from '.'

import leasingNinjaUseCase from '../../use-cases/leasing-ninja'
import spec from '../key-storage-spec'

spec(() => new InMemoryKeyStorage())
leasingNinjaUseCase(() => ({
  contracts: new InMemoryComponentStorage(),
  contractKeys: new InMemoryKeyStorage(),
  installments: new InMemoryComponentStorage(),
  calculatedInstallements: new InMemoryComponentStorage(),
  signatures: new InMemoryComponentStorage(),
}))
