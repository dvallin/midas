import { describe, expect, it } from 'vitest'
import { ComponentStorage } from '../storage'
import { Importer } from '../service/importer'
import { InferType, object, omit, record, string, and } from '@spaceteams/zap'

export const AttributesSchema = record(string())
export const SkuSchema = object({
  parent: string(),
  attributes: AttributesSchema,
})
export const VariantSchema = object({
  variantKey: string(),
  attributes: AttributesSchema,
})
export const ProductSchema = and(
  omit(VariantSchema, 'variantKey'),
  object({
    skus: record(omit(SkuSchema, 'parent')),
  }),
)

export type Sku = InferType<typeof SkuSchema>
export type Variant = InferType<typeof VariantSchema>
export type Product = InferType<typeof ProductSchema>

export default function (
  provider: () => {
    skus: ComponentStorage<Sku>
    variants: ComponentStorage<Variant>
    products: ComponentStorage<Product>
    cursors: ComponentStorage<string>
  },
) {
  describe('product-variants-usecase', () => {
    it('creates a product based on variants and skus', async () => {
      // given
      const { skus, variants, products, cursors } = provider()

      await variants.write('product-id', {
        variantKey: 'color',
        attributes: { name: 'Dragon figurine' },
      })
      // we assume that we can only write skus once the variant has been created
      await skus.write('1', {
        parent: 'product-id',
        attributes: { color: 'red', size: 'xxl' },
      })
      await skus.write('2', {
        parent: 'product-id',
        attributes: { color: 'red', size: 'l' },
      })

      // when skus are updated we need to mix them into the product
      const importer = new Importer(cursors)
      await importer.runImport(
        'products-sku-update-importer',
        skus,
        async (skuId, sku) => {
          const id = sku.parent
          const variant = await variants.readOrThrow(id)
          const product = await products.read(id)
          const updated = onSkuChange(product, variant, skuId, sku)
          await products.conditionalWrite(id, updated, product)
        },
      )
      // when variants are updated we also need to mix them into the products
      await importer.runImport(
        'products-variants-update-importer',
        variants,
        async (id, variant) => {
          const product = await products.readOrThrow(id)
          const updated = onVariantChange(product, variant)
          await products.conditionalWrite(id, updated, product)
        },
      )

      // then
      expect(await products.read('product-id')).toEqual({
        attributes: { name: 'Dragon figurine', color: 'red' },
        skus: {
          '1': {
            attributes: { size: 'xxl' },
          },
          '2': {
            attributes: { size: 'l' },
          },
        },
      })
    })
  })
}

function onSkuChange(
  product: Product | undefined,
  variant: Variant,
  skuId: string,
  sku: Sku,
): Product {
  const { [variant.variantKey]: variantValue, ...attributes } = sku.attributes
  return {
    attributes: { [variant.variantKey]: variantValue, ...variant.attributes },
    skus: {
      ...(product?.skus ?? {}),
      [skuId]: { attributes },
    },
  }
}
function onVariantChange(product: Product, variant: Variant): Product {
  const { [variant.variantKey]: variantValue } = product.attributes
  return {
    attributes: { [variant.variantKey]: variantValue, ...variant.attributes },
    skus: product.skus,
  }
}
