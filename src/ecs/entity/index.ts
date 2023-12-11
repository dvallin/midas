export type EntityId = string

export interface EntityIdGenerator {
  generate(): EntityId
}

export * from './nanoid-generator'
export * from './uuid-generator'
