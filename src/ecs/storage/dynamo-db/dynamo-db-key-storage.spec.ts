import { afterAll, beforeAll } from 'vitest'
import { DynamoDbKeyStorage, DynamoDbComponentStorage } from '.'

import leasingNinjaUseCase, {
  CalculatedInstallmentSchema,
  ContractSchema,
  InstallmentSchema,
  SignatureSchema,
} from '../../use-cases/leasing-ninja'
import keyStorageSpec from '../key-storage-spec'
import { createTestDynamoDbStorage } from './create-test-dynamo-db-storage'
import { string } from '@spaceteams/zap'

const { storage } = await createTestDynamoDbStorage('dynamo-db-key-storage', {
  keyStorageSpec: { type: 'key', tracksUpdates: false, schema: string() },
  contracts: { type: 'array', tracksUpdates: false, schema: ContractSchema },
  contractKeys: { type: 'key', tracksUpdates: false, schema: string() },
  installments: {
    type: 'array',
    tracksUpdates: false,
    schema: InstallmentSchema,
  },
  calculatedInstallements: {
    type: 'array',
    tracksUpdates: false,
    schema: CalculatedInstallmentSchema,
  },
  signatures: { type: 'array', tracksUpdates: false, schema: SignatureSchema },
})

beforeAll(() => storage.migrate())
afterAll(() => storage.teardown())

keyStorageSpec(() => new DynamoDbKeyStorage('keyStorageSpec', storage))
leasingNinjaUseCase(() => ({
  contracts: new DynamoDbComponentStorage('contracts', storage),
  contractKeys: new DynamoDbKeyStorage('contractKeys', storage),
  installments: new DynamoDbComponentStorage('installments', storage),
  calculatedInstallements: new DynamoDbComponentStorage(
    'calculatedInstallements',
    storage,
  ),
  signatures: new DynamoDbComponentStorage('signatures', storage),
}))
