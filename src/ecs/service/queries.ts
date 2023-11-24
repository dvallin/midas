import { ComponentStorage, InferComponentType } from '../storage'

type Storages = { [componentName: string]: ComponentStorage<unknown> }

export type GetResult<T extends Storages> = {
  [key in keyof T]: InferComponentType<T[key]> | undefined
}
export type GetManyResult<T extends Storages> = {
  [entityId: string]: GetResult<T>
}

export class Query<T extends Storages> {
  constructor(protected readonly storages: T) {}

  async getById(entityId: string): Promise<GetResult<T>> {
    const result: Record<string, unknown> = {}
    const componentNames = Object.keys(this.storages)
    const requests = []
    for (const componentName of componentNames) {
      requests.push(this.storages[componentName].read(entityId))
    }
    const responses = await Promise.all(requests)
    for (let i = 0; i < componentNames.length; i++) {
      result[componentNames[i]] = responses[i]
    }
    return result as GetResult<T>
  }

  async getManyById(entityIds: string[]): Promise<GetManyResult<T>> {
    const result: Record<string, Record<string, unknown>> = {}
    for (const id of entityIds) {
      result[id] = {}
    }
    const componentNames = Object.keys(this.storages)
    const requests = []
    for (const componentName of componentNames) {
      requests.push(this.storages[componentName].batchRead(entityIds))
    }
    const responses = await Promise.all(requests)
    for (let i = 0; i < componentNames.length; i++) {
      for (const id of entityIds) {
        result[id][componentNames[i]] = responses[i][id].value
      }
    }
    return result as GetManyResult<T>
  }
}
