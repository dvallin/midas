import { describe, expect, it } from 'vitest'
import { ComponentStorage, UpdateStorage } from '../storage'
import { Importer } from '../service/importer'
import { and, InferType, object, omit, record, string } from '@spaceteams/zap'
import { ZipImporter } from '../service/zip-importer'

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
    skuUpdates: UpdateStorage
    variants: ComponentStorage<Variant>
    variantUpdates: UpdateStorage
    products: ComponentStorage<Product>
    cursors: ComponentStorage<string>
  },
) {
  describe('product-variants-usecase', () => {
    it('creates a product based on variants and skus', async () => {
      // given
      const { skus, skuUpdates, variantUpdates, variants, products, cursors } =
        provider()

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
      await new Importer({
        name: 'products-sku-update-importer',
        cursors,
        storage: skus,
        updateStorage: skuUpdates,
      }).runImportWithSchema(SkuSchema, async (skuId, sku) => {
        const id = sku.parent
        const variant = await variants.readOrThrow(id)
        const product = await products.read(id)
        const updated = onSkuChange(product, variant, skuId, sku)
        await products.conditionalWrite(id, updated, product)
      })
      // when variants are updated we also need to mix them into the products
      await new ZipImporter({
        name: 'products-variants-update-importer',
        cursors,
        storages: { variant: variants, product: products },
        updateStorages: { variantUpdates },
      }).runImportWithSchema(
        object({ variant: VariantSchema, product: ProductSchema }),
        async (id, { variant, product }) => {
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
