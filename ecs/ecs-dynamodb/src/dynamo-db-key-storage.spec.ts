import { afterAll, beforeAll } from 'vitest'
import leasingNinjaUseCase, {
  CalculatedInstallmentSchema,
  ContractSchema,
  InstallmentSchema,
  SignatureSchema,
} from 'ecs-core/src/use-cases/leasing-ninja'
import keyStorageSpec from 'ecs-core/src/component/key-storage-spec'
import {
  componentConfig,
  componentStorageConfig,
  UuidGenerator,
} from 'ecs-core'
import { string } from '@spaceteams/zap'

import { DynamoDbComponentStorage, DynamoDbKeyStorage } from '.'
import { createTestDynamoDbStorage } from './create-test-dynamo-db-storage'

const { storage } = await createTestDynamoDbStorage('dynamo-db-key-storage', {
  keyStorageSpec: componentConfig({
    type: 'key',
    schema: string(),
    storageConfig: componentStorageConfig({ type: 'dynamo' }),
  }),
  contracts: componentConfig({
    type: 'default',
    schema: ContractSchema,
    storageConfig: componentStorageConfig({ type: 'dynamo' }),
  }),
  contractKeys: componentConfig({
    type: 'key',
    schema: string(),
    storageConfig: componentStorageConfig({ type: 'dynamo' }),
  }),
  installments: componentConfig({
    type: 'default',
    schema: InstallmentSchema,
    storageConfig: componentStorageConfig({ type: 'dynamo' }),
  }),
  calculatedInstallements: componentConfig({
    type: 'default',
    schema: CalculatedInstallmentSchema,
    storageConfig: componentStorageConfig({ type: 'dynamo' }),
  }),
  signatures: componentConfig({
    type: 'default',
    schema: SignatureSchema,
    storageConfig: componentStorageConfig({ type: 'dynamo' }),
  }),
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
  idGenerator: new UuidGenerator(),
}))
