import { UpdateStorage } from '..'
import { ComponentConfig } from '../..'
import { ElasticsearchStorage } from './elasticsearch-storage'

export class ElasticsearchUpdateStorage<
  Components extends {
    [componentName: string]: ComponentConfig
  },
> implements UpdateStorage {
  constructor(
    protected readonly componentName: string,
    protected readonly storage: ElasticsearchStorage<Components>,
  ) {}

  async *updates(
    cursor?: string,
  ): AsyncGenerator<{ entityId: string; cursor: string }> {
    let currentCursor = parseFloat(cursor ?? '0')
    while (true) {
      const result = await this.storage.updates(
        this.componentName,
        currentCursor,
      )

      if (result.hits.hits.length === 0) {
        return
      }

      for (const hit of result.hits.hits) {
        const entityId = hit._id
        const lastModified = hit._source?.lastModified
        if (!lastModified) {
          throw new Error('last modified missing')
        }
        currentCursor = lastModified
        yield { entityId, cursor: currentCursor.toString() }
      }
    }
  }
}
