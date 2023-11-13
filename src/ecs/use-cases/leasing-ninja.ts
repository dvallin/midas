import { describe, expect, it } from 'vitest'
import { ComponentStorage, KeyStorage } from '../storage'
import { InferType, coercedDate, number, object } from '@spaceteams/zap'
import { nanoid } from 'nanoid'
import { getById } from '../service/get-by-id'

export const ContractSchema = object({
  customerId: number(),
  carId: number(),
  price: number(),
})
type Contract = InferType<typeof ContractSchema>

export const ContractKeySchema = number()
type ContractKey = InferType<typeof ContractKeySchema>

export const InstallmentSchema = object({
  leaseTerm: number(),
  interest: number(),
})
type Installment = InferType<typeof InstallmentSchema>

export const CalculatedInstallmentSchema = object({
  pmt: number(),
})
type CalculatedInstallment = InferType<typeof CalculatedInstallmentSchema>
function calculateInstallment(installment: Installment): CalculatedInstallment {
  return {
    // replace by actual finance math
    pmt: installment.interest * installment.leaseTerm,
  }
}

export const SignatureSchema = object({
  signedAt: coercedDate(),
})
type Signature = InferType<typeof SignatureSchema>

type LeasingNinjaContext = {
  contracts: ComponentStorage<Contract>
  contractKeys: KeyStorage
  installments: ComponentStorage<Installment & CalculatedInstallment>
  signatures: ComponentStorage<Signature>
}
async function addContract(
  key: ContractKey,
  contract: Contract,
  { contracts, contractKeys }: LeasingNinjaContext,
) {
  const id = nanoid()
  await contracts.write(id, contract)
  await contractKeys.write(id, key.toString())
}
async function addInstallment(
  key: ContractKey,
  installment: Installment,
  { contractKeys, installments }: LeasingNinjaContext,
) {
  const id = await contractKeys.getByKeyOrThrow(key.toString())
  const calculation = calculateInstallment(installment)
  await installments.write(id, { ...installment, ...calculation })
}
async function signContract(
  key: ContractKey,
  signedAt: Date,
  { contractKeys, signatures }: LeasingNinjaContext,
) {
  const id = await contractKeys.getByKeyOrThrow(key.toString())
  await signatures.write(id, { signedAt })
}
async function showContract(
  key: ContractKey,
  { contractKeys, contracts, installments, signatures }: LeasingNinjaContext,
) {
  const id = await contractKeys.getByKeyOrThrow(key.toString())
  const { contract, installment, signature } = await getById(id, {
    contract: contracts,
    installment: installments,
    signature: signatures,
  })
  if (!contract) {
    throw new Error('contract missing')
  }
  return {
    carId: contract.carId,
    hasInstallment: installment !== undefined,
    hasSignature: signature !== undefined,
  }
}

export default function (provider: () => LeasingNinjaContext) {
  describe('leasing ninja', () => {
    it('supports a happy-path of a contract', async () => {
      // given
      const context = provider()

      // when
      // contract is created
      await addContract(
        123,
        { customerId: 1, carId: 3, price: 123_000 },
        context,
      )
      const contractWithIntialData = await showContract(123, context)

      // and then installments are written
      await addInstallment(123, { interest: 12, leaseTerm: 48 }, context)
      const contractWithInstallments = await showContract(123, context)

      // and the contract is signed
      await signContract(123, new Date('2020-01-01'), context)
      const contractWithSignature = await showContract(123, context)

      // then
      expect(contractWithIntialData).toMatchInlineSnapshot(`
        {
          "carId": 3,
          "hasInstallment": false,
          "hasSignature": false,
        }
      `)
      expect(contractWithInstallments).toMatchInlineSnapshot(`
        {
          "carId": 3,
          "hasInstallment": true,
          "hasSignature": false,
        }
      `)
      expect(contractWithSignature).toMatchInlineSnapshot(`
        {
          "carId": 3,
          "hasInstallment": true,
          "hasSignature": true,
        }
      `)
    })
  })
}
