import { ComponentStorage, InferComponentType } from '../storage'

export type GetResult<
  T extends { [componentName: string]: ComponentStorage<unknown> },
> = { [key in keyof T]: InferComponentType<T[key]> | undefined }
export async function getById<
  T extends { [componentName: string]: ComponentStorage<unknown> },
>(entityId: string, storages: T): Promise<GetResult<T>> {
  const value: Record<string, unknown> = {}
  for (const componentName of Object.keys(storages)) {
    value[componentName] = await storages[componentName].read(entityId)
  }
  return value as GetResult<T>
}
