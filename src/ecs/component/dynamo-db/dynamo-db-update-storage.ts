import { QueryCommandOutput } from '@aws-sdk/lib-dynamodb'
import { UpdateStorage } from '..'
import { DynamoDbStorage } from './dynamo-db-storage'
import { ComponentConfig } from '../..'

export class DynamoDbUpdateStorage<
  Components extends {
    [componentName: string]: ComponentConfig
  },
> implements UpdateStorage {
  constructor(
    protected componentName: string,
    protected storage: DynamoDbStorage<Components>,
  ) {}

  async *updates(
    cursor?: string,
  ): AsyncGenerator<{ entityId: string; cursor: string }> {
    if (cursor) {
      const lastModified = parseFloat(cursor)
      for (const cursor of this.storage.cursorsOf(lastModified)) {
        yield* this.updatesOfDate(cursor)
      }
    } else {
      yield* this.allUpdates()
    }
  }

  private async *updatesOfDate(lastModified: number) {
    let cursor = undefined
    do {
      const result = await this.storage.updates(
        this.componentName,
        lastModified,
        cursor,
      )
      yield* this.yieldItems(result)
      cursor = result.LastEvaluatedKey
    } while (cursor)
  }

  private async *allUpdates() {
    let cursor = undefined
    do {
      const result = await this.storage.all(this.componentName, cursor)
      yield* this.yieldItems(result)
      cursor = result.LastEvaluatedKey
    } while (cursor)
  }

  private *yieldItems(result: QueryCommandOutput) {
    for (const item of result.Items ?? []) {
      yield {
        entityId: item.entityId,
        cursor: item.lastModified.toString(),
      }
    }
  }
}
