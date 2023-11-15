import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
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
import { DynamoDBStreams } from '@aws-sdk/client-dynamodb-streams'
import { Time, TimeContext } from '../../service/time'
import { EcsBaseContext } from '../..'
import { addDays, differenceInDays, startOfDay } from 'date-fns'

export type DynamoDbStorageContext = DynamoDbContext &
  EcsBaseContext &
  TimeContext & {
    storage: {
      dynamodb: {
        config: {
          returnConsumedCapacity?: ReturnConsumedCapacity
        }
      }
    }
  }
export const dynamoDbStorageContextMiddleware = <C>(
  returnConsumedCapacity?: ReturnConsumedCapacity,
): ContextExtensionMiddleware<C, DynamoDbStorageContext> => {
  return async (_e, ctx, next) => {
    const c = ctx as { storage?: Record<string, unknown> }
    if (!c.storage) {
      c.storage = {}
    }
    c.storage.dynamodb = {
      config: {
        returnConsumedCapacity,
      },
    }
    return await next(ctx as C & DynamoDbStorageContext)
  }
}

export class DynamoDbStorage {
  protected readonly client: DynamoDBDocument
  protected readonly dynamoStreams: DynamoDBStreams
  protected readonly components: EcsBaseContext['components']
  protected readonly returnConsumedCapacity?: ReturnConsumedCapacity
  protected readonly clusterId: string
  protected readonly time: Time
  constructor(
    context: DynamoDbContext &
      DynamoDbStorageContext &
      EcsBaseContext &
      TimeContext,
  ) {
    this.client = context.aws.dynamoDb
    this.clusterId = context.clusterId
    this.dynamoStreams = context.aws.dynamoStreams
    this.components = context.components
    this.returnConsumedCapacity =
      context.storage.dynamodb.config.returnConsumedCapacity
    this.time = context.service.time
  }

  getTableName(componentName: string) {
    return `${this.clusterId}_component_${componentName}`
  }

  getSchema(componentName: string) {
    return this.components[componentName].schema
  }

  async read(
    componentName: string,
    entityId: string,
  ): Promise<unknown | undefined> {
    const result = await this.client.get({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      Key: {
        entityId,
      },
    })
    return result.Item?.component
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
    return result.Items?.[0]?.entityId
  }

  async all(componentName: string) {
    const tableName = this.getTableName(componentName)
    return await this.client.scan({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: tableName,
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

  async updates(componentName: string, lastModified: number) {
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
      KeyConditionExpression: `lastModifiedDate = :bucket and lastModified > :cursor`,
      ExpressionAttributeValues: {
        ':bucket': lastModifiedDate,
        ':cursor': lastModified,
      },
      ScanIndexForward: true,
    })
  }

  getDateString(timestamp: number) {
    const date = new Date(timestamp)
    return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`
  }

  datesAfter(datum: number): Date[] {
    const days = differenceInDays(this.time.now, datum)
    const result: Date[] = []
    let current = startOfDay(datum)
    for (let i = 0; i < days; i++) {
      current = addDays(current, 1)
      result.push(current)
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
