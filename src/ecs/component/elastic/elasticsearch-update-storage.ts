import { UpdateStorage } from '..'
import { ElasticsearchStorage } from './elasticsearch-storage'

export class ElasticsearchUpdateStorage implements UpdateStorage {
  constructor(
    protected readonly componentName: string,
    protected readonly storage: ElasticsearchStorage,
  ) {}

  async *updates(
    cursor?: string,
  ): AsyncGenerator<{ entityId: string; cursor: string }> {
    const result = await this.storage.updates(
      this.componentName,
      parseFloat(cursor ?? '0'),
    )

    for (const hit of result.hits.hits) {
      const entityId = hit._id
      const lastModified = hit._source?.lastModified
      if (!lastModified) {
        throw new Error('last modified missing')
      }
      yield { entityId, cursor: lastModified.toString() }
    }
  }
}
