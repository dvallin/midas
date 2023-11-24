import {
  BatchGetCommandOutput,
  BatchWriteCommandOutput,
  DynamoDBDocument,
} from '@aws-sdk/lib-dynamodb'
import {
  ContextExtensionMiddleware,
  DynamoDbContext,
} from '../../../middleware'
import {
  CreateTableCommand,
  CreateTableCommandInput,
  DeleteTableCommand,
  ReturnConsumedCapacity,
} from '@aws-sdk/client-dynamodb'
import { Time, TimeContext } from '../../service/time'
import { BatchWrite, EcsBaseContext } from '../..'
import { addDays, differenceInDays, startOfDay } from 'date-fns'

export type DynamoDbStorageContext =
  & DynamoDbContext
  & EcsBaseContext
  & TimeContext
  & {
    storage: {
      dynamodb: {
        config: {
          returnConsumedCapacity?: ReturnConsumedCapacity
        }
      }
    }
  }
export const dynamoDbStorageContextMiddleware = <
  C extends DynamoDbContext & EcsBaseContext & TimeContext,
>(
  returnConsumedCapacity?: ReturnConsumedCapacity,
  batchingSize?: number,
): ContextExtensionMiddleware<C, DynamoDbStorageContext> => {
  return async (_e, ctx, next) => {
    const c = ctx as { storage?: Record<string, unknown> }
    if (!c.storage) {
      c.storage = {}
    }
    c.storage.dynamodb = {
      config: {
        returnConsumedCapacity,
        batchingSize,
      },
    }
    return await next(ctx as C & DynamoDbStorageContext)
  }
}

export class DynamoDbStorage {
  protected readonly client: DynamoDBDocument
  protected readonly components: EcsBaseContext['components']
  protected readonly returnConsumedCapacity?: ReturnConsumedCapacity
  protected readonly clusterId: string
  protected readonly time: Time
  protected readonly batchSize: number
  constructor(
    context:
      & DynamoDbContext
      & DynamoDbStorageContext
      & EcsBaseContext
      & TimeContext,
  ) {
    this.client = context.aws.dynamoDb
    this.clusterId = context.clusterId
    this.components = context.components
    this.returnConsumedCapacity =
      context.storage.dynamodb.config.returnConsumedCapacity
    this.time = context.service.time
    this.batchSize = Math.min(context.storage.batchSize ?? 10, 25)
  }

  getTableName(componentName: string) {
    return `${this.clusterId}_component_${componentName}`
  }

  getSchema(componentName: string) {
    return this.components[componentName].schema
  }

  async read<T>(
    componentName: string,
    entityId: string,
  ): Promise<T | undefined> {
    const result = await this.client.get({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      Key: {
        entityId,
      },
    })
    return result?.Item?.component
  }

  async batchRead<T>(
    componentName: string,
    entityIds: string[],
  ): Promise<{
    components: { [entityId: string]: T | undefined }
    unprocessed: string[]
  }> {
    const tableName = this.getTableName(componentName)

    const components: { [entityId: string]: T | undefined } = {}
    const unprocessed: string[] = []

    const ids = [...entityIds]
    const responses: Promise<BatchGetCommandOutput>[] = []
    while (ids.length) {
      const batch = ids.splice(0, this.batchSize)
      responses.push(
        this.client.batchGet({
          ReturnConsumedCapacity: this.returnConsumedCapacity,
          RequestItems: {
            [tableName]: {
              Keys: batch.map((v) => ({ entityId: v })),
            },
          },
        }),
      )
    }

    const results = await Promise.all(responses)
    for (const result of results) {
      for (const row of result.Responses?.[tableName] ?? []) {
        components[row.entityId] = row.component
      }
      for (const key of result.UnprocessedKeys?.[tableName]?.Keys ?? []) {
        unprocessed.push(key.entityId.S)
      }
    }

    return {
      components,
      unprocessed,
    }
  }

  async getByKey(componentName: string, key: string) {
    const componentType = this.components[componentName].type
    if (componentType !== 'key') {
      throw new Error(
        `cannot perform a get by key on component ${componentName} of type ${componentType}`,
      )
    }
    const tableName = this.getTableName(componentName)
    const result = await this.client.query({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      IndexName: `${tableName}_key_index`,
      KeyConditionExpression: `component = :component`,
      ExpressionAttributeValues: {
        ':component': key,
      },
      ScanIndexForward: true,
    })
    if ((result.Items?.length ?? 0) > 1) {
      throw new Error('key found more than once')
    }
    return result.Items?.[0]?.entityId
  }

  async all(
    componentName: string,
    exclusiveStartKey?: Record<string, unknown>,
  ) {
    const tableName = this.getTableName(componentName)
    return await this.client.scan({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: tableName,
      ExclusiveStartKey: exclusiveStartKey,
    })
  }

  async write(componentName: string, entityId: string, component: unknown) {
    const lastModified = this.time.now
    const lastModifiedDate = this.getDateString(lastModified)
    await this.client.put({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      Item: {
        entityId,
        component,
        lastModifiedDate,
        lastModified,
      },
    })
    return lastModified
  }

  async batchWrite(componentName: string, writes: BatchWrite<unknown>[]) {
    const tableName = this.getTableName(componentName)

    const lastModifiedByEntityId: { [entityId: string]: number } = {}
    const unprocessed: string[] = []

    const responses: Promise<BatchWriteCommandOutput>[] = []
    const ops = [...writes]
    while (ops.length) {
      const batch = ops.splice(0, this.batchSize)

      const requests = []
      for (const { entityId, component } of batch) {
        const lastModified = this.time.now
        const lastModifiedDate = this.getDateString(lastModified)
        lastModifiedByEntityId[entityId] = lastModified
        requests.push({
          PutRequest: {
            Item: {
              entityId,
              component,
              lastModifiedDate,
              lastModified,
            },
          },
        })
      }
      responses.push(
        this.client.batchWrite({
          ReturnConsumedCapacity: this.returnConsumedCapacity,
          RequestItems: {
            [tableName]: requests,
          },
        }),
      )
    }

    const results = await Promise.all(responses)
    for (const result of results) {
      for (const item of result.UnprocessedItems?.[tableName] ?? []) {
        unprocessed.push(item.PutRequest?.Item?.entityId.S)
      }
    }

    return { unprocessed, lastModifiedByEntityId }
  }

  async conditionalWrite(
    componentName: string,
    entityId: string,
    current: unknown,
    previous: unknown | undefined = undefined,
  ): Promise<number> {
    const lastModified = this.time.now
    const lastModifiedDate = this.getDateString(lastModified)
    await this.client.put({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      Item: {
        entityId,
        component: current,
        lastModified,
        lastModifiedDate,
      },
      ConditionExpression: previous
        ? 'component = :previousValue'
        : 'attribute_not_exists(component)',
      ExpressionAttributeValues: previous
        ? { ':previousValue': previous }
        : undefined,
    })
    return lastModified
  }

  async updates(
    componentName: string,
    lastModified: number,
    exclusiveStartKey?: Record<string, unknown>,
  ) {
    const tracksUpdates = this.components[componentName].tracksUpdates
    if (!tracksUpdates) {
      throw new Error(
        `component ${componentName} does not support update tracking`,
      )
    }
    const lastModifiedDate = this.getDateString(lastModified)
    const tableName = this.getTableName(componentName)
    return await this.client.query({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: tableName,
      IndexName: `${tableName}_update_index`,
      KeyConditionExpression:
        `lastModifiedDate = :lastModifiedDate and lastModified > :lastModified`,
      ExpressionAttributeValues: {
        ':lastModifiedDate': lastModifiedDate,
        ':lastModified': lastModified,
      },
      ScanIndexForward: true,
      ExclusiveStartKey: exclusiveStartKey,
    })
  }

  getDateString(timestamp: number) {
    const date = new Date(timestamp)
    return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`
  }

  /**
   * Returns a list of cursors greater than lastModified for each bucket
   * @param lastModified the first cursor to consider
   * @returns list of cursors
   */
  cursorsOf(lastModified: number): number[] {
    const result = [lastModified]
    const days = differenceInDays(this.time.now, lastModified)
    let current = startOfDay(lastModified)
    for (let i = 0; i < days; i++) {
      current = addDays(current, 1)
      result.push(current.valueOf())
    }
    return result
  }

  async push(componentName: string, entityId: string, component: unknown) {
    const componentType = this.components[componentName].type
    if (componentType !== 'array') {
      throw new Error(
        `cannot perform a array:push on component ${componentName} of type ${componentType}`,
      )
    }
    const lastModified = this.time.now
    const lastModifiedDate = this.getDateString(lastModified)
    await this.client.update({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      Key: {
        entityId,
      },
      UpdateExpression:
        'SET #component.boxed = list_append(#component.boxed, :values), lastModified = :lastModified, lastModifiedDate = :lastModifiedDate',
      ExpressionAttributeNames: {
        '#component': 'component',
      },
      ExpressionAttributeValues: {
        ':values': [component],
        ':lastModified': lastModified,
        ':lastModifiedDate': lastModifiedDate,
      },
      ConditionExpression: 'attribute_exists(component)',
      ReturnValues: 'NONE',
    })
    return lastModified
  }

  async add(componentName: string, entityId: string, component: unknown) {
    const componentType = this.components[componentName].type
    if (componentType !== 'set') {
      throw new Error(
        `cannot perform a setadd on component ${componentName} of type ${componentType}`,
      )
    }
    const lastModified = this.time.now
    const lastModifiedDate = this.getDateString(lastModified)
    await this.client.update({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      Key: {
        entityId,
      },
      UpdateExpression: `ADD #component.boxed :value
         SET lastModified = :lastModified, lastModifiedDate = :lastModifiedDate
        `,
      ExpressionAttributeNames: {
        '#component': 'component',
      },
      ExpressionAttributeValues: {
        ':value': new Set([component]),
        ':lastModified': lastModified,
        ':lastModifiedDate': lastModifiedDate,
      },
      ConditionExpression: 'attribute_exists(component)',
      ReturnValues: 'NONE',
    })
    return lastModified
  }

  async delete(componentName: string, entityId: string, component: unknown) {
    const componentType = this.components[componentName].type
    if (componentType !== 'set') {
      throw new Error(
        `cannot perform a set delete on component ${componentName} of type ${componentType}`,
      )
    }
    const lastModified = this.time.now
    const lastModifiedDate = this.getDateString(lastModified)
    await this.client.update({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      Key: {
        entityId,
      },
      UpdateExpression: `DELETE #component.boxed :value
        SET lastModified = :lastModified, lastModifiedDate = :lastModifiedDate
        `,
      ExpressionAttributeNames: {
        '#component': 'component',
      },
      ExpressionAttributeValues: {
        ':value': new Set([component]),
        ':lastModified': lastModified,
        ':lastModifiedDate': lastModifiedDate,
      },
      ConditionExpression: 'attribute_exists(component)',
      ReturnValues: 'NONE',
    })
    return lastModified
  }

  defaultPrimaryTableMigration(componentName: string): CreateTableCommandInput {
    return {
      TableName: this.getTableName(componentName),
      KeySchema: [{ AttributeName: 'entityId', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'entityId', AttributeType: 'S' }],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
    }
  }

  async migrate() {
    for (const componentName of Object.keys(this.components)) {
      const { type, tracksUpdates } = this.components[componentName]
      const primaryTable = this.defaultPrimaryTableMigration(componentName)

      if (type === 'key') {
        if (primaryTable.GlobalSecondaryIndexes === undefined) {
          primaryTable.GlobalSecondaryIndexes = []
        }
        primaryTable.AttributeDefinitions?.push({
          AttributeName: 'component',
          AttributeType: 'S',
        })
        primaryTable.GlobalSecondaryIndexes!.push({
          IndexName: `${primaryTable.TableName}_key_index`,
          KeySchema: [{ AttributeName: 'component', KeyType: 'HASH' }],
          Projection: {
            ProjectionType: 'KEYS_ONLY',
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        })
      }

      if (tracksUpdates) {
        if (primaryTable.GlobalSecondaryIndexes === undefined) {
          primaryTable.GlobalSecondaryIndexes = []
        }
        primaryTable.AttributeDefinitions?.push({
          AttributeName: 'lastModified',
          AttributeType: 'N',
        })
        primaryTable.AttributeDefinitions?.push({
          AttributeName: 'lastModifiedDate',
          AttributeType: 'S',
        })
        primaryTable.GlobalSecondaryIndexes!.push({
          IndexName: `${primaryTable.TableName}_update_index`,
          KeySchema: [
            { AttributeName: 'lastModifiedDate', KeyType: 'HASH' },
            { AttributeName: 'lastModified', KeyType: 'RANGE' },
          ],
          Projection: {
            ProjectionType: 'KEYS_ONLY',
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        })
      }

      await this.client.send(new CreateTableCommand(primaryTable))
    }
  }

  async teardown() {
    for (const componentName of Object.keys(this.components)) {
      await this.client.send(
        new DeleteTableCommand({
          TableName: this.getTableName(componentName),
        }),
      )
    }
  }
}
