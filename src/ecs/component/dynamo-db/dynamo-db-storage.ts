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
import {
  ComponentConfig,
  EcsBaseContext,
  InferComponents,
  ValidationMode,
} from '../..'
import { addDays, differenceInDays, startOfDay } from 'date-fns'
import { BatchWrite } from '..'
import { validateThrowing } from './schema-parse'

export type DynamoDbStorageContext<
  Components extends {
    [componentName: string]: ComponentConfig
  },
> =
  & DynamoDbContext
  & EcsBaseContext<Components>
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
  Components extends {
    [componentName: string]: ComponentConfig
  },
  C extends DynamoDbContext & EcsBaseContext<Components> & TimeContext,
>(
  returnConsumedCapacity?: ReturnConsumedCapacity,
  batchingSize?: number,
): ContextExtensionMiddleware<
  C,
  DynamoDbStorageContext<InferComponents<C>>
> => {
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
    return await next(ctx as C & DynamoDbStorageContext<InferComponents<C>>)
  }
}

export class DynamoDbStorage<
  Components extends {
    [componentName: string]: ComponentConfig
  },
> {
  protected readonly client: DynamoDBDocument
  protected readonly components: EcsBaseContext<Components>['components']
  protected readonly returnConsumedCapacity?: ReturnConsumedCapacity
  protected readonly clusterId: string
  protected readonly time: Time
  protected readonly batchSize: number
  protected readonly defaultValidationMode: ValidationMode
  constructor(context: DynamoDbStorageContext<Components>) {
    this.client = context.aws.dynamoDb
    this.clusterId = context.clusterId
    this.components = context.components
    this.returnConsumedCapacity =
      context.storage.dynamodb.config.returnConsumedCapacity
    this.time = context.service.time
    this.batchSize = Math.min(context.storage.batchSize ?? 10, 25)
    this.defaultValidationMode = context.storage.validationMode ?? 'readWrite'
  }

  supports(componentName: string) {
    return this.components[componentName].storageConfig.type === 'dynamo'
  }

  getTableName(componentName: string) {
    return `${this.clusterId}_component_${componentName}`
  }

  getSchema(componentName: string) {
    return this.components[componentName].schema
  }

  validationMode(componentName: string) {
    return (
      this.components[componentName].storageConfig.validationMode ??
        this.defaultValidationMode
    )
  }

  async read<T>(
    componentName: string,
    entityId: string,
  ): Promise<T | undefined | null> {
    const result = await this.client.get({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      Key: {
        entityId,
      },
    })
    if (result.Item === undefined) {
      return undefined
    }
    return result.Item?.component ?? null
  }

  async batchRead<T>(
    componentName: string,
    entityIds: string[],
  ): Promise<{
    components: { [entityId: string]: T | undefined | null }
    unprocessed: string[]
  }> {
    const tableName = this.getTableName(componentName)

    const components: { [entityId: string]: T | undefined | null } = {}
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
        components[row.entityId] = row.component ?? null
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

  async allSchedules(
    componentName: string,
    exclusiveStartKey?: Record<string, unknown>,
  ) {
    const tableName = this.getTableName(componentName)
    return await this.client.scan({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: tableName,
      FilterExpression: 'attribute_exists(schedule)',
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

  async readSchedule(componentName: string, entityId: string) {
    const result = await this.client.get({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      Key: {
        entityId,
      },
    })
    if (result.Item === undefined) {
      return undefined
    }
    return result.Item?.schedule ?? null
  }

  async batchReadSchedule(
    componentName: string,
    entityIds: string[],
  ): Promise<{
    schedules: { [entityId: string]: number | undefined | null }
    unprocessed: string[]
  }> {
    const tableName = this.getTableName(componentName)

    const schedules: { [entityId: string]: number | undefined | null } = {}
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
        schedules[row.entityId] = row.schedule ?? null
      }
      for (const key of result.UnprocessedKeys?.[tableName]?.Keys ?? []) {
        unprocessed.push(key.entityId.S)
      }
    }

    return {
      schedules,
      unprocessed,
    }
  }

  async batchWriteSchedules(componentName: string, writes: BatchWrite<Date>[]) {
    const tableName = this.getTableName(componentName)

    const lastModifiedByEntityId: { [entityId: string]: number } = {}
    const unprocessed: string[] = []

    const responses: Promise<BatchWriteCommandOutput>[] = []
    const ops = [...writes]
    while (ops.length) {
      const batch = ops.splice(0, this.batchSize)

      const requests = []
      for (const { entityId, component } of batch) {
        const schedule = component.valueOf()
        const scheduleDate = this.getDateString(schedule)
        const lastModified = this.time.now
        const lastModifiedDate = this.getDateString(lastModified)
        lastModifiedByEntityId[entityId] = lastModified
        requests.push({
          PutRequest: {
            Item: {
              entityId,
              schedule,
              scheduleDate,
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

  async writeSchedule(componentName: string, entityId: string, date: Date) {
    const lastModified = this.time.now
    const lastModifiedDate = this.getDateString(lastModified)
    const schedule = date.valueOf()
    const scheduleDate = this.getDateString(schedule)
    await this.client.put({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      Item: {
        entityId,
        schedule,
        scheduleDate,
        lastModifiedDate,
        lastModified,
      },
    })
    return lastModified
  }

  async deleteSchedule(componentName: string, entityId: string) {
    const lastModified = this.time.now
    const lastModifiedDate = this.getDateString(lastModified)
    await this.client.update({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      Key: {
        entityId,
      },
      UpdateExpression: `REMOVE #schedule,  #scheduleDate
        SET lastModified = :lastModified, lastModifiedDate = :lastModifiedDate`,
      ExpressionAttributeNames: {
        '#schedule': 'schedule',
        '#scheduleDate': 'scheduleDate',
      },
      ExpressionAttributeValues: {
        ':lastModified': lastModified,
        ':lastModifiedDate': lastModifiedDate,
      },
      ReturnValues: 'NONE',
    })
    return lastModified
  }

  delete(componentName: string, entityId: string) {
    return this.client.delete({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      Key: {
        entityId,
      },
    })
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

  async conditionalWriteSchedule(
    componentName: string,
    entityId: string,
    current: Date,
    previous: Date | undefined = undefined,
  ): Promise<number> {
    const lastModified = this.time.now
    const lastModifiedDate = this.getDateString(lastModified)
    const schedule = current.valueOf()
    const scheduleDate = this.getDateString(schedule)
    await this.client.put({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      Item: {
        entityId,
        schedule,
        scheduleDate,
        lastModified,
        lastModifiedDate,
      },
      ConditionExpression: previous
        ? 'schedule = :previousValue'
        : 'attribute_not_exists(schedule)',
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

  async schedules(
    componentName: string,
    cursor: number,
    exclusiveStartKey?: Record<string, unknown>,
  ) {
    const type = this.components[componentName].type
    if (type !== 'schedule') {
      throw new Error(
        `component ${componentName} does not support next update tracking`,
      )
    }
    const scheduleDate = this.getDateString(cursor)
    const tableName = this.getTableName(componentName)
    return await this.client.query({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: tableName,
      IndexName: `${tableName}_schedule_index`,
      KeyConditionExpression:
        `scheduleDate = :scheduleDate and schedule > :schedule`,
      ExpressionAttributeValues: {
        ':scheduleDate': scheduleDate,
        ':schedule': cursor,
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

  async arrayPush(componentName: string, entityId: string, component: unknown) {
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
        'SET #component = list_append(if_not_exists(#component, :empty_list), :value), lastModified = :lastModified, lastModifiedDate = :lastModifiedDate',
      ExpressionAttributeNames: {
        '#component': 'component',
      },
      ExpressionAttributeValues: {
        ':empty_list': [],
        ':value': [component],
        ':lastModified': lastModified,
        ':lastModifiedDate': lastModifiedDate,
      },
      ReturnValues: 'NONE',
    })
    return lastModified
  }

  async arrayRemove(componentName: string, entityId: string, index: number) {
    const componentType = this.components[componentName].type
    if (componentType !== 'array') {
      throw new Error(
        `cannot perform a array:remove on component ${componentName} of type ${componentType}`,
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
      UpdateExpression: `REMOVE #component[${index}]
       SET lastModified = :lastModified, lastModifiedDate = :lastModifiedDate`,
      ExpressionAttributeNames: {
        '#component': 'component',
      },
      ExpressionAttributeValues: {
        ':lastModified': lastModified,
        ':lastModifiedDate': lastModifiedDate,
      },
      ConditionExpression: 'attribute_exists(component)',
      ReturnValues: 'NONE',
    })
    return lastModified
  }

  async setAdd(componentName: string, entityId: string, values: string[]) {
    const componentType = this.components[componentName].type
    if (componentType !== 'set') {
      throw new Error(
        `cannot perform a set:add on component ${componentName} of type ${componentType}`,
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
      UpdateExpression: `ADD #component :value
         SET lastModified = :lastModified, lastModifiedDate = :lastModifiedDate
        `,
      ExpressionAttributeNames: {
        '#component': 'component',
      },
      ExpressionAttributeValues: {
        ':value': new Set(values),
        ':lastModified': lastModified,
        ':lastModifiedDate': lastModifiedDate,
      },
      ReturnValues: 'NONE',
    })
    return lastModified
  }

  async conditionalSetAdd(
    componentName: string,
    entityId: string,
    values: string[],
  ) {
    const componentType = this.components[componentName].type
    if (componentType !== 'set') {
      throw new Error(
        `cannot perform a conditional set:add on component ${componentName} of type ${componentType}`,
      )
    }
    const lastModified = this.time.now
    const lastModifiedDate = this.getDateString(lastModified)

    const expressionAttributeValues: Record<string, unknown> = {
      ':value': new Set(values),
      ':lastModified': lastModified,
      ':lastModifiedDate': lastModifiedDate,
    }
    for (let i = 0; i < values.length; i++) {
      expressionAttributeValues[`:val_${i}`] = values[i]
    }

    await this.client.update({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      Key: {
        entityId,
      },
      UpdateExpression: `ADD #component :value
         SET lastModified = :lastModified, lastModifiedDate = :lastModifiedDate
        `,
      ExpressionAttributeNames: {
        '#component': 'component',
      },
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: values
        .map((_, i) => `not contains(#component, :val_${i})`)
        .join(' and '),
      ReturnValues: 'NONE',
    })
    return lastModified
  }

  async setDelete(componentName: string, entityId: string, values: string[]) {
    const componentType = this.components[componentName].type
    if (componentType !== 'set') {
      throw new Error(
        `cannot perform a set:delete on component ${componentName} of type ${componentType}`,
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
      UpdateExpression: `DELETE #component :value
        SET lastModified = :lastModified, lastModifiedDate = :lastModifiedDate
        `,
      ExpressionAttributeNames: {
        '#component': 'component',
      },
      ExpressionAttributeValues: {
        ':value': new Set(values),
        ':lastModified': lastModified,
        ':lastModifiedDate': lastModifiedDate,
      },
      ReturnValues: 'NONE',
    })
    return lastModified
  }

  async conditionalSetDelete(
    componentName: string,
    entityId: string,
    values: string[],
  ) {
    const componentType = this.components[componentName].type
    if (componentType !== 'set') {
      throw new Error(
        `cannot perform a conditional set:delete on component ${componentName} of type ${componentType}`,
      )
    }
    const lastModified = this.time.now
    const lastModifiedDate = this.getDateString(lastModified)

    const expressionAttributeValues: Record<string, unknown> = {
      ':value': new Set(values),
      ':lastModified': lastModified,
      ':lastModifiedDate': lastModifiedDate,
    }
    for (let i = 0; i < values.length; i++) {
      expressionAttributeValues[`:val_${i}`] = values[i]
    }

    await this.client.update({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      Key: {
        entityId,
      },
      UpdateExpression: `DELETE #component :value
        SET lastModified = :lastModified, lastModifiedDate = :lastModifiedDate
        `,
      ExpressionAttributeNames: {
        '#component': 'component',
      },
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: values
        .map((_, i) => `contains(#component, :val_${i})`)
        .join(' and '),
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
      } else if (type === 'schedule') {
        if (primaryTable.GlobalSecondaryIndexes === undefined) {
          primaryTable.GlobalSecondaryIndexes = []
        }
        primaryTable.AttributeDefinitions?.push({
          AttributeName: 'schedule',
          AttributeType: 'N',
        })
        primaryTable.AttributeDefinitions?.push({
          AttributeName: 'scheduleDate',
          AttributeType: 'S',
        })
        primaryTable.GlobalSecondaryIndexes!.push({
          IndexName: `${primaryTable.TableName}_schedule_index`,
          KeySchema: [
            { AttributeName: 'scheduleDate', KeyType: 'HASH' },
            { AttributeName: 'schedule', KeyType: 'RANGE' },
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
