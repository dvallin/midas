import { InferType, object, string } from '@spaceteams/zap'
import { component } from '..'
import { expect, it } from 'vitest'

export const ProductSchema = object({
  ean: string(),
  category: string(),
})
type Product = InferType<typeof ProductSchema>

type DataEntryContext = {
  dataset: component.SearchStorage<Product>
}

async function validateUniqueness(
  key: keyof Product,
  value: string,
  context: DataEntryContext,
) {
  const matches = await context.dataset.match({ [key]: value })
  return matches.length === 0 || matches.length === 1
}

export default function spec(provider: () => DataEntryContext) {
  it('validates uniqueness', async () => {
    const ctx = provider()
    expect(await validateUniqueness('ean', 'ean', ctx)).toBeTruthy()

    await ctx.dataset.write('1', { ean: 'ean', category: 'category' })
    expect(await validateUniqueness('ean', 'ean', ctx)).toBeTruthy()

    await ctx.dataset.write('2', { ean: 'ean', category: 'category' })
    expect(await validateUniqueness('ean', 'ean', ctx)).toBeFalsy()
  })

  it('suggests based on prefix', async () => {
    const ctx = provider()
    await ctx.dataset.write('1', { ean: 'ean', category: 'shoes' })
    await ctx.dataset.write('2', { ean: 'ean', category: 'shirts' })
    await ctx.dataset.write('3', { ean: 'ean', category: 'dresses' })

    const suggestions = await ctx.dataset.suggest('category', {
      category: 'sh',
    })
    expect(suggestions).toEqual(['shirts', 'shoes'])
  })
}
