import { UpdateStorage } from '..'
import { DynamoDbStorage } from './dynamo-db-storage'

export class DynamoDbUpdateStorage implements UpdateStorage {
  constructor(
    protected componentName: string,
    protected storage: DynamoDbStorage,
  ) {}

  async *updates(
    cursor?: string,
  ): AsyncGenerator<{ entityId: string; cursor: string }> {
    if (cursor) {
      const lastModified = parseFloat(cursor)
      const result = await this.storage.updates(
        this.componentName,
        lastModified,
      )
      for (const item of result.Items ?? []) {
        yield {
          entityId: item.entityId,
          cursor: item.lastModified,
        }
      }
      for (const startDate of this.storage.datesAfter(lastModified)) {
        const result = await this.storage.updates(
          this.componentName,
          startDate.valueOf(),
        )
        for (const item of result.Items ?? []) {
          yield {
            entityId: item.entityId,
            cursor: item.lastModified,
          }
        }
      }
    } else {
      const result = await this.storage.all(this.componentName)
      for (const item of result.Items ?? []) {
        yield {
          entityId: item.entityId,
          cursor: item.lastModified,
        }
      }
    }
  }
}
