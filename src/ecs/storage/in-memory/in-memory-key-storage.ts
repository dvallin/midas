import { InMemoryComponentStorage } from './in-memory-component-storage'
import { KeyStorage } from '..'

export class InMemoryKeyStorage
  extends InMemoryComponentStorage<string>
  implements KeyStorage
{
  async getByKey(key: string): Promise<string | undefined> {
    for (const id of Object.keys(this.storage)) {
      if (this.storage[id].component === key) {
        return id
      }
    }
    return undefined
  }
  async getByKeyOrThrow(key: string): Promise<string> {
    const result = await this.getByKey(key)
    if (!result) {
      throw new Error(`could not find entity for key ${key}`)
    }
    return result
  }
}
